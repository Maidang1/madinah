#[cfg(test)]
use super::BindingObserver;
use super::{
    bind_custom_executable, builtin_agents, probe_agent, probe_agent_for_epoch, probe_bound_agent,
    probe_bound_agent_for_epoch, validate_registration_count, AgentCapabilities, AgentDefinition,
    AgentInfo, AgentSource, AgentStatus, AuthMethodInfo, BindingControl, ProbeResult,
    RegistrationSnapshot,
};
use futures::{stream, StreamExt};
use serde::{Deserialize, Serialize};
use std::path::Path;
#[cfg(test)]
use std::path::PathBuf;
use std::sync::atomic::AtomicU64;
use std::sync::Arc;
use std::time::Duration;

pub(super) const MAX_CONCURRENT_PROBES: usize = 3;

#[cfg(test)]
#[derive(Debug, Clone)]
pub enum CustomDiscoveryEvent {
    Missing {
        source: PathBuf,
    },
    Ready {
        source: PathBuf,
        executable: PathBuf,
    },
    CopyProgress {
        source: PathBuf,
        artifact: PathBuf,
        copied_bytes: u64,
    },
    Finished {
        artifact: PathBuf,
    },
}

#[cfg(test)]
type CustomDiscoveryObserver = Arc<dyn Fn(CustomDiscoveryEvent) + Send + Sync>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDiscovery {
    pub id: String,
    pub name: String,
    pub source: AgentSource,
    pub command: String,
    pub args: Vec<String>,
    pub setup_url: String,
    pub capabilities: AgentCapabilities,
    pub status: AgentStatus,
    pub message: String,
    pub missing_capabilities: Vec<String>,
    pub agent_info: Option<AgentInfo>,
    pub auth_methods: Vec<AuthMethodInfo>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryResponse {
    pub workspace_root: String,
    pub registration_revision: u64,
    pub registration_error: Option<String>,
    pub agents: Vec<AgentDiscovery>,
}

#[cfg(test)]
pub async fn discover_agents(
    workspace_root: String,
    snapshot: RegistrationSnapshot,
    registration_error: Option<String>,
    deadline: Duration,
) -> DiscoveryResponse {
    discover_agents_inner(
        workspace_root,
        snapshot,
        registration_error,
        deadline,
        None,
        None,
    )
    .await
}

#[cfg(test)]
pub async fn discover_agents_observed(
    workspace_root: String,
    snapshot: RegistrationSnapshot,
    deadline: Duration,
    observer: CustomDiscoveryObserver,
) -> DiscoveryResponse {
    discover_agents_inner(
        workspace_root,
        snapshot,
        None,
        deadline,
        None,
        Some(observer),
    )
    .await
}

#[cfg(test)]
pub async fn discover_agents_for_epoch_observed(
    workspace_root: String,
    snapshot: RegistrationSnapshot,
    deadline: Duration,
    epoch: Arc<AtomicU64>,
    expected_epoch: u64,
    observer: CustomDiscoveryObserver,
) -> DiscoveryResponse {
    discover_agents_inner(
        workspace_root,
        snapshot,
        None,
        deadline,
        Some((epoch, expected_epoch)),
        Some(observer),
    )
    .await
}

pub async fn discover_agents_for_epoch(
    workspace_root: String,
    snapshot: RegistrationSnapshot,
    registration_error: Option<String>,
    deadline: Duration,
    epoch: Arc<AtomicU64>,
    expected_epoch: u64,
) -> DiscoveryResponse {
    discover_agents_inner(
        workspace_root,
        snapshot,
        registration_error,
        deadline,
        Some((epoch, expected_epoch)),
        None,
    )
    .await
}

async fn discover_agents_inner(
    workspace_root: String,
    snapshot: RegistrationSnapshot,
    registration_error: Option<String>,
    deadline: Duration,
    cancellation: Option<(Arc<AtomicU64>, u64)>,
    #[cfg(test)] observer: Option<CustomDiscoveryObserver>,
    #[cfg(not(test))] _observer: Option<()>,
) -> DiscoveryResponse {
    let revision = snapshot.revision;
    let mut registration_error = registration_error;
    let mut definitions = builtin_agents();
    let registrations = match validate_registration_count(snapshot.registrations.len()) {
        Ok(()) => snapshot.registrations,
        Err(error) => {
            registration_error = Some(match registration_error {
                Some(existing) => format!("{existing} {error}"),
                None => error,
            });
            Vec::new()
        }
    };
    definitions.extend(registrations.into_iter().map(|registration| {
        let name = Path::new(&registration.command)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(&registration.command)
            .to_string();
        AgentDefinition {
            id: registration.id,
            name,
            source: AgentSource::Custom,
            command: registration.command,
            args: registration.args,
            setup_url: String::new(),
            capabilities: AgentCapabilities::default(),
        }
    }));

    let agents = stream::iter(definitions.into_iter().map(|definition| {
        let cancellation = cancellation.clone();
        #[cfg(test)]
        let observer = observer.clone();
        async move {
            let probe = if definition.source == AgentSource::Custom {
                #[cfg(test)]
                let binding_observer: Option<BindingObserver> = observer.as_ref().map(|observer| {
                    let observer = observer.clone();
                    Arc::new(move |progress: super::BindingProgress| {
                        observer(CustomDiscoveryEvent::CopyProgress {
                            source: progress.source,
                            artifact: progress.artifact,
                            copied_bytes: progress.copied_bytes,
                        });
                    }) as BindingObserver
                });
                #[cfg(not(test))]
                let binding_control = BindingControl::new(cancellation.clone());
                #[cfg(test)]
                let binding_control = BindingControl::new(cancellation.clone())
                    .with_observer(binding_observer);
                let binding_command = definition.command.clone();
                let binding_args = definition.args.clone();
                let binding = tokio::task::spawn_blocking(move || {
                    bind_custom_executable(&binding_command, &binding_args, &binding_control)
                })
                .await;
                match binding {
                    Err(error) => ProbeResult::failed(
                        AgentStatus::HandshakeFailed,
                        format!("The registered custom Agent binding task failed: {error}"),
                    ),
                    Ok(Ok(None)) => {
                        #[cfg(test)]
                        if let Some(observer) = &observer {
                            observer(CustomDiscoveryEvent::Missing {
                                source: Path::new(&definition.command).to_path_buf(),
                            });
                        }
                        ProbeResult::failed(
                            AgentStatus::Missing,
                            format!(
                                "Executable `{}` was not found. Install it, then retry.",
                                definition.command
                            ),
                        )
                    }
                    Ok(Err(message)) => ProbeResult::failed(
                        AgentStatus::HandshakeFailed,
                        format!(
                            "The registered custom Agent failed native executable binding: {message}"
                        ),
                    ),
                    Ok(Ok(Some(bound))) => {
                        #[cfg(test)]
                        let artifact = bound.path().to_path_buf();
                        #[cfg(test)]
                        if let Some(observer) = &observer {
                            observer(CustomDiscoveryEvent::Ready {
                                source: Path::new(&definition.command).to_path_buf(),
                                executable: bound.path().to_path_buf(),
                            });
                        }
                        let mut result = match cancellation {
                            Some((epoch, expected_epoch)) => {
                                probe_bound_agent_for_epoch(
                                    bound,
                                    &definition.args,
                                    deadline,
                                    epoch,
                                    expected_epoch,
                                )
                                .await
                            }
                            None => probe_bound_agent(bound, &definition.args, deadline).await,
                        };
                        if result.status == AgentStatus::HandshakeFailed {
                            result.message = format!(
                                "Custom Agents run from a private executable copy. Register a self-contained native ACP executable that does not require sibling resources, helpers, or libraries through current_exe, $ORIGIN, or @executable_path. {}",
                                result.message
                            );
                        }
                        #[cfg(test)]
                        if let Some(observer) = &observer {
                            observer(CustomDiscoveryEvent::Finished { artifact });
                        }
                        result
                    }
                }
            } else {
                match cancellation {
                    Some((epoch, expected_epoch)) => {
                        probe_agent_for_epoch(
                            &definition.command,
                            &definition.args,
                            deadline,
                            epoch,
                            expected_epoch,
                        )
                        .await
                    }
                    None => probe_agent(&definition.command, &definition.args, deadline).await,
                }
            };
            AgentDiscovery {
                id: definition.id,
                name: definition.name,
                source: definition.source,
                command: definition.command,
                args: definition.args,
                setup_url: definition.setup_url,
                capabilities: definition.capabilities,
                status: probe.status,
                message: probe.message,
                missing_capabilities: probe.missing_capabilities,
                agent_info: probe.agent_info,
                auth_methods: probe.auth_methods,
            }
        }
    }))
    .buffered(MAX_CONCURRENT_PROBES)
    .collect()
    .await;

    DiscoveryResponse {
        workspace_root,
        registration_revision: revision,
        registration_error,
        agents,
    }
}

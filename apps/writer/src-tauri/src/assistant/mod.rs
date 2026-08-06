mod catalog;
mod consent;
mod discovery;
mod probe;
mod registrations;
mod runtime;
mod turn;

// These serde models own the Assistant discovery IPC wire contract. The
// TypeScript mirror and ownership rules are documented in
// ../docs/assistant-discovery-contract.md from the Writer app root.

#[cfg(test)]
pub use catalog::CapabilitySupport;
pub(super) use catalog::{bind_custom_executable, BindingControl, BoundCustomExecutable};
pub use catalog::{
    builtin_agents, validate_custom_command, validate_stored_custom_registration,
    AgentCapabilities, AgentDefinition, AgentSource,
};
#[cfg(test)]
pub(super) use catalog::{BindingObserver, BindingProgress};
pub use consent::{grant_consent, load_consents, ConsentSnapshot, ConsentStatus};
#[cfg(test)]
pub use discovery::{
    discover_agents, discover_agents_for_epoch_observed, discover_agents_observed,
    CustomDiscoveryEvent,
};
pub use discovery::{discover_agents_for_epoch, DiscoveryResponse};
pub use probe::{
    probe_agent, probe_agent_for_epoch, probe_bound_agent, probe_bound_agent_for_epoch, AgentInfo,
    AgentStatus, AuthMethodInfo, ProbeResult,
};
#[cfg(test)]
pub use registrations::CustomAgentRegistration;
pub use registrations::{
    add_registration, load_registrations, remove_registration, validate_registration_count,
    RegistrationSnapshot,
};
pub(super) use runtime::{
    run_agent_turn, run_bound_agent_turn, RuntimeChannels, RuntimeOutcome,
    RuntimePermissionRequest, RuntimeUpdate,
};
#[cfg(test)]
pub use turn::ReconcileResult;
pub use turn::{
    AgentCoordinator, FrontendLeaseIdentity, LifecycleRequest, PrepareAcknowledgement,
    PrepareResult, ReconcileAcknowledgement, TurnPermissionOption, TurnPhase, TurnReservation,
    WriterMutationPermit, WriterMutationPreparation,
};

#[cfg(all(test, unix))]
pub fn build_native_fake_agent(directory: &std::path::Path, mode: &str) -> std::path::PathBuf {
    static COMPILED_FAKE_AGENT: std::sync::OnceLock<(tempfile::TempDir, std::path::PathBuf)> =
        std::sync::OnceLock::new();
    let (_, compiled) = COMPILED_FAKE_AGENT.get_or_init(|| {
        let build_directory = tempfile::tempdir().expect("create native fake ACP Agent build dir");
        let compiled = build_directory.path().join("fake-acp-agent-native");
        let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/fake_acp_agent.rs");
        let status = std::process::Command::new("rustc")
            .args(["--edition", "2021"])
            .arg(source)
            .arg("-o")
            .arg(&compiled)
            .status()
            .expect("compile native fake ACP Agent");
        assert!(status.success(), "native fake ACP Agent did not compile");
        (build_directory, compiled)
    });
    let executable = directory.join(format!("{mode}-{}-fake-acp-agent", uuid::Uuid::new_v4()));
    std::fs::copy(compiled, &executable).expect("copy native fake ACP Agent");
    if mode == "sibling_required" {
        std::fs::write(directory.join("runtime-resource.txt"), "fixture resource")
            .expect("write fake Agent sibling resource");
    }
    executable
        .canonicalize()
        .expect("canonical native fake ACP Agent")
}

#[cfg(all(test, unix))]
pub fn fake_agent_artifact_path(
    executable: &std::path::Path,
    extension: &str,
) -> std::path::PathBuf {
    let name = executable
        .file_name()
        .and_then(|name| name.to_str())
        .expect("native fake ACP Agent filename");
    std::env::temp_dir().join(format!("writer-{name}.{extension}"))
}

#[cfg(test)]
mod tests {
    use super::{
        add_registration, build_native_fake_agent, builtin_agents, fake_agent_artifact_path,
        load_registrations, remove_registration, AgentSource, AgentStatus, CapabilitySupport,
        CustomAgentRegistration, CustomDiscoveryEvent, DiscoveryResponse, RegistrationSnapshot,
    };
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;
    #[cfg(unix)]
    use std::{fs, os::unix::fs::PermissionsExt};

    fn native_test_executable() -> String {
        std::env::current_exe()
            .unwrap()
            .canonicalize()
            .unwrap()
            .to_string_lossy()
            .into_owned()
    }

    #[cfg(unix)]
    fn install_marker_script(path: &std::path::Path, marker: &std::path::Path) {
        fs::write(
            path,
            format!("#!/bin/sh\nprintf executed > '{}'\n", marker.display()),
        )
        .unwrap();
        fs::set_permissions(path, fs::Permissions::from_mode(0o755)).unwrap();
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn custom_discovery_spawns_the_bound_artifact_when_the_source_is_replaced() {
        let dir = tempfile::tempdir().unwrap();
        let source = build_native_fake_agent(dir.path(), "compatible");
        let registration_path = dir.path().join("assistant-agents.json");
        let snapshot = add_registration(
            &registration_path,
            source.to_string_lossy().into_owned(),
            vec!["--stdio".into()],
        )
        .unwrap();
        let registration_id = snapshot.registrations[0].id.clone();
        let marker = dir.path().join("replacement-executed");
        let pid = fake_agent_artifact_path(&source, "pids");
        let source_for_hook = source.clone();
        let marker_for_hook = marker.clone();
        let bound_path = Arc::new(Mutex::new(None));
        let bound_path_for_hook = bound_path.clone();
        let response = super::discover_agents_observed(
            "/workspace".into(),
            snapshot,
            Duration::from_secs(5),
            Arc::new(move |event| {
                if let CustomDiscoveryEvent::Ready { source, executable } = event {
                    assert_eq!(source, source_for_hook);
                    assert!(
                        executable.exists(),
                        "bound executable must exist before spawn"
                    );
                    *bound_path_for_hook.lock().unwrap() = Some(executable);
                    let original = source.with_extension("original");
                    fs::rename(&source, original).unwrap();
                    install_marker_script(&source, &marker_for_hook);
                }
            }),
        )
        .await;

        let custom = response
            .agents
            .iter()
            .find(|agent| agent.id == registration_id)
            .unwrap();
        assert_eq!(
            custom.status,
            AgentStatus::Compatible,
            "unexpected bound probe result: {}",
            custom.message
        );
        assert!(
            !marker.exists(),
            "replacement source was executed after binding"
        );
        assert!(
            !bound_path.lock().unwrap().as_ref().unwrap().exists(),
            "private bound executable survived discovery cleanup"
        );
        assert_process_is_gone(&pid);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn custom_discovery_returns_missing_when_a_source_appears_after_classification() {
        let dir = tempfile::tempdir().unwrap();
        let source = build_native_fake_agent(dir.path(), "compatible");
        let registration_path = dir.path().join("assistant-agents.json");
        let snapshot = add_registration(
            &registration_path,
            source.to_string_lossy().into_owned(),
            vec![],
        )
        .unwrap();
        let registration_id = snapshot.registrations[0].id.clone();
        fs::remove_file(&source).unwrap();
        let marker = dir.path().join("late-source-executed");
        let source_for_hook = source.clone();
        let marker_for_hook = marker.clone();
        let response = super::discover_agents_observed(
            "/workspace".into(),
            snapshot,
            Duration::from_millis(300),
            Arc::new(move |event| {
                if let CustomDiscoveryEvent::Missing { source } = event {
                    assert_eq!(source, source_for_hook);
                    install_marker_script(&source, &marker_for_hook);
                }
            }),
        )
        .await;

        let custom = response
            .agents
            .iter()
            .find(|agent| agent.id == registration_id)
            .unwrap();
        assert_eq!(custom.status, AgentStatus::Missing);
        assert!(!marker.exists(), "late-created source was spawned");
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn bound_artifacts_are_removed_after_timeout_and_cancellation() {
        for cancelled in [false, true] {
            let dir = tempfile::tempdir().unwrap();
            let source = build_native_fake_agent(dir.path(), "hang");
            let pid = fake_agent_artifact_path(&source, "pids");
            let registration_path = dir.path().join("assistant-agents.json");
            let snapshot = add_registration(
                &registration_path,
                source.to_string_lossy().into_owned(),
                vec!["--stdio".into()],
            )
            .unwrap();
            let bound_path = Arc::new(Mutex::new(None));
            let bound_path_for_hook = bound_path.clone();
            let epoch = Arc::new(std::sync::atomic::AtomicU64::new(1));
            let epoch_for_hook = epoch.clone();
            let observer = Arc::new(move |event| {
                if let CustomDiscoveryEvent::Ready { executable, .. } = event {
                    *bound_path_for_hook.lock().unwrap() = Some(executable);
                    if cancelled {
                        let epoch = epoch_for_hook.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(Duration::from_millis(50));
                            epoch.store(2, std::sync::atomic::Ordering::Release);
                        });
                    }
                }
            });

            let response = if cancelled {
                super::discover_agents_for_epoch_observed(
                    "/workspace".into(),
                    snapshot,
                    Duration::from_secs(2),
                    epoch,
                    1,
                    observer,
                )
                .await
            } else {
                super::discover_agents_observed(
                    "/workspace".into(),
                    snapshot,
                    Duration::from_millis(100),
                    observer,
                )
                .await
            };

            assert_eq!(response.agents[2].status, AgentStatus::HandshakeFailed);
            assert!(
                !bound_path.lock().unwrap().as_ref().unwrap().exists(),
                "bound artifact survived {}",
                if cancelled { "cancellation" } else { "timeout" }
            );
            assert_process_is_gone(&pid);
        }
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn cancellation_during_binding_stops_before_probe_and_removes_the_partial_artifact() {
        let dir = tempfile::tempdir().unwrap();
        let source = build_native_fake_agent(dir.path(), "compatible");
        let snapshot = add_registration(
            &dir.path().join("assistant-agents.json"),
            source.to_string_lossy().into_owned(),
            vec!["--stdio".into()],
        )
        .unwrap();
        let epoch = Arc::new(std::sync::atomic::AtomicU64::new(1));
        let epoch_for_hook = epoch.clone();
        let source_for_hook = source.clone();
        let artifact_parent = Arc::new(Mutex::new(None));
        let artifact_parent_for_hook = artifact_parent.clone();
        let became_ready = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let became_ready_for_hook = became_ready.clone();

        let response = super::discover_agents_for_epoch_observed(
            "/workspace".into(),
            snapshot,
            Duration::from_secs(1),
            epoch,
            1,
            Arc::new(move |event| match event {
                CustomDiscoveryEvent::CopyProgress {
                    source,
                    artifact,
                    copied_bytes: 0,
                } => {
                    assert_eq!(source, source_for_hook);
                    *artifact_parent_for_hook.lock().unwrap() =
                        artifact.parent().map(std::path::Path::to_path_buf);
                    epoch_for_hook.store(2, std::sync::atomic::Ordering::Release);
                }
                CustomDiscoveryEvent::Ready { .. } => {
                    became_ready_for_hook.store(true, std::sync::atomic::Ordering::Release);
                }
                _ => {}
            }),
        )
        .await;

        assert_eq!(response.agents[2].status, AgentStatus::HandshakeFailed);
        assert!(response.agents[2].message.contains("superseded"));
        assert!(!became_ready.load(std::sync::atomic::Ordering::Acquire));
        let artifact_parent = artifact_parent.lock().unwrap().clone().unwrap();
        assert!(
            !artifact_parent.exists(),
            "partial private binding directory survived cancellation"
        );
    }

    #[cfg(unix)]
    #[tokio::test(flavor = "current_thread")]
    async fn custom_binding_does_not_block_the_async_discovery_runtime() {
        let dir = tempfile::tempdir().unwrap();
        let source = build_native_fake_agent(dir.path(), "compatible");
        let snapshot = add_registration(
            &dir.path().join("assistant-agents.json"),
            source.to_string_lossy().into_owned(),
            vec![],
        )
        .unwrap();
        let delayed_once = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let delayed_once_for_hook = delayed_once.clone();
        let observer = Arc::new(move |event| {
            if matches!(
                event,
                CustomDiscoveryEvent::CopyProgress {
                    copied_bytes: 0,
                    ..
                }
            ) && !delayed_once_for_hook.swap(true, std::sync::atomic::Ordering::AcqRel)
            {
                std::thread::sleep(Duration::from_millis(500));
            }
        });

        let started = std::time::Instant::now();
        let discovery = super::discover_agents_observed(
            "/workspace".into(),
            snapshot,
            Duration::from_secs(5),
            observer,
        );
        let heartbeat = async {
            tokio::time::sleep(Duration::from_millis(10)).await;
            started.elapsed()
        };
        let (response, heartbeat_elapsed) = tokio::join!(discovery, heartbeat);

        assert!(
            heartbeat_elapsed < Duration::from_millis(250),
            "blocking executable binding starved the async runtime for {heartbeat_elapsed:?}"
        );
        assert_eq!(response.agents[2].status, AgentStatus::Compatible);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn sibling_dependent_custom_runtime_has_an_actionable_binding_classification() {
        let dir = tempfile::tempdir().unwrap();
        let source = build_native_fake_agent(dir.path(), "sibling_required");
        assert!(source
            .parent()
            .unwrap()
            .join("runtime-resource.txt")
            .exists());
        let snapshot = add_registration(
            &dir.path().join("assistant-agents.json"),
            source.to_string_lossy().into_owned(),
            vec![],
        )
        .unwrap();

        let response =
            super::discover_agents("/workspace".into(), snapshot, None, Duration::from_secs(5))
                .await;
        let custom = &response.agents[2];

        assert_eq!(custom.status, AgentStatus::HandshakeFailed);
        assert!(custom.message.contains("required sibling runtime resource"));
        for guidance in [
            "self-contained",
            "current_exe",
            "$ORIGIN",
            "@executable_path",
        ] {
            assert!(
                custom.message.contains(guidance),
                "missing `{guidance}` in actionable message: {}",
                custom.message
            );
        }
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn discovery_never_holds_more_than_three_bounded_custom_artifacts() {
        let dir = tempfile::tempdir().unwrap();
        let registration_path = dir.path().join("assistant-agents.json");
        let mut snapshot = RegistrationSnapshot::default();
        let mut pid_paths = Vec::new();
        for _ in 0..4 {
            let source = build_native_fake_agent(dir.path(), "compatible");
            pid_paths.push(fake_agent_artifact_path(&source, "pids"));
            snapshot = add_registration(
                &registration_path,
                source.to_string_lossy().into_owned(),
                vec![],
            )
            .unwrap();
        }
        let active = Arc::new(Mutex::new(std::collections::HashSet::new()));
        let active_for_hook = active.clone();
        let maximum = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let maximum_for_hook = maximum.clone();

        let response = super::discover_agents_observed(
            "/workspace".into(),
            snapshot,
            Duration::from_secs(5),
            Arc::new(move |event| match event {
                CustomDiscoveryEvent::CopyProgress {
                    artifact,
                    copied_bytes: 0,
                    ..
                } => {
                    let mut active = active_for_hook.lock().unwrap();
                    let key = artifact.file_name().unwrap().to_os_string();
                    if active.insert(key) {
                        maximum_for_hook
                            .fetch_max(active.len(), std::sync::atomic::Ordering::AcqRel);
                        drop(active);
                        std::thread::sleep(Duration::from_millis(75));
                    }
                }
                CustomDiscoveryEvent::Finished { artifact } => {
                    active_for_hook
                        .lock()
                        .unwrap()
                        .remove(artifact.file_name().unwrap());
                }
                _ => {}
            }),
        )
        .await;

        assert!(response.agents[2..]
            .iter()
            .all(|agent| agent.status == AgentStatus::Compatible));
        let maximum = maximum.load(std::sync::atomic::Ordering::Acquire);
        assert!(maximum > 0);
        assert!(maximum <= super::discovery::MAX_CONCURRENT_PROBES);
        assert_eq!(
            super::discovery::MAX_CONCURRENT_PROBES as u64
                * super::catalog::MAX_CUSTOM_EXECUTABLE_BYTES,
            384 * 1024 * 1024
        );
        assert!(active.lock().unwrap().is_empty());
        for pid in pid_paths {
            assert_process_is_gone(&pid);
        }
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn spawn_failure_removes_the_private_bound_artifact() {
        let dir = tempfile::tempdir().unwrap();
        let source = build_native_fake_agent(dir.path(), "compatible");
        let snapshot = add_registration(
            &dir.path().join("assistant-agents.json"),
            source.to_string_lossy().into_owned(),
            vec![],
        )
        .unwrap();
        let artifact_parent = Arc::new(Mutex::new(None));
        let artifact_parent_for_hook = artifact_parent.clone();

        let response = super::discover_agents_observed(
            "/workspace".into(),
            snapshot,
            Duration::from_secs(1),
            Arc::new(move |event| {
                if let CustomDiscoveryEvent::Ready { executable, .. } = event {
                    *artifact_parent_for_hook.lock().unwrap() =
                        executable.parent().map(std::path::Path::to_path_buf);
                    fs::remove_file(executable).unwrap();
                }
            }),
        )
        .await;

        assert_eq!(response.agents[2].status, AgentStatus::Missing);
        assert!(!artifact_parent.lock().unwrap().clone().unwrap().exists());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn bound_artifact_is_removed_after_a_protocol_error() {
        let dir = tempfile::tempdir().unwrap();
        let source = build_native_fake_agent(dir.path(), "malformed");
        let pid = fake_agent_artifact_path(&source, "pids");
        let snapshot = add_registration(
            &dir.path().join("assistant-agents.json"),
            source.to_string_lossy().into_owned(),
            vec![],
        )
        .unwrap();
        let bound_path = Arc::new(Mutex::new(None));
        let bound_path_for_hook = bound_path.clone();
        let response = super::discover_agents_observed(
            "/workspace".into(),
            snapshot,
            Duration::from_secs(1),
            Arc::new(move |event| {
                if let CustomDiscoveryEvent::Ready { executable, .. } = event {
                    *bound_path_for_hook.lock().unwrap() = Some(executable);
                }
            }),
        )
        .await;

        assert_eq!(response.agents[2].status, AgentStatus::HandshakeFailed);
        assert!(!bound_path.lock().unwrap().as_ref().unwrap().exists());
        assert_process_is_gone(&pid);
    }

    #[tokio::test]
    async fn discovery_rejects_an_over_limit_snapshot_before_queueing_custom_agents() {
        let snapshot = RegistrationSnapshot {
            version: 1,
            revision: 1,
            registrations: (0..33)
                .map(|index| CustomAgentRegistration {
                    id: format!("over-limit-{index}"),
                    command: format!("/definitely/missing/agent-{index}"),
                    args: Vec::new(),
                })
                .collect(),
        };

        let response = super::discover_agents(
            "/workspace".into(),
            snapshot,
            None,
            Duration::from_millis(20),
        )
        .await;

        assert_eq!(response.agents.len(), 2);
        assert!(response
            .registration_error
            .as_deref()
            .is_some_and(|error| error.contains("at most 32")));
    }

    #[test]
    fn custom_registration_accepts_only_bounded_valueless_transport_switches() {
        let executable = native_test_executable();
        for args in [
            vec![],
            vec!["--stdio"],
            vec!["--acp"],
            vec!["--stdio", "--acp"],
        ] {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("assistant-agents.json");
            let args = args.into_iter().map(String::from).collect::<Vec<_>>();
            assert!(
                add_registration(&path, executable.clone(), args).is_ok(),
                "safe valueless transport switches must remain useful"
            );
        }

        for args in [
            vec!["opaque-secret"],
            vec!["--model", "local"],
            vec!["--profile=work"],
            vec!["--stdio=secret"],
            vec!["================"],
        ] {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("assistant-agents.json");
            let args = args.into_iter().map(String::from).collect::<Vec<_>>();
            let error = add_registration(&path, executable.clone(), args).unwrap_err();
            assert!(error.contains("safe valueless ACP transport switches"));
            assert!(!path.exists(), "unsafe arguments reached persistence");
        }
    }

    #[test]
    fn custom_registration_bounds_every_input_before_persistence() {
        let executable = native_test_executable();
        for (args, expected) in [
            (vec!["--stdio".to_string(); 5], "at most 4 arguments"),
            (vec!["x".repeat(33)], "at most 32 bytes"),
            (vec!["x".repeat(20); 4], "at most 64 bytes"),
            (vec!["x=".repeat(10_000)], "at most 32 bytes"),
        ] {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("assistant-agents.json");
            let error = add_registration(&path, executable.clone(), args).unwrap_err();
            assert!(error.contains(expected), "unexpected error: {error}");
            assert!(!path.exists());
        }

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("assistant-agents.json");
        let error = add_registration(&path, format!("/{}", "x".repeat(4096)), vec![]).unwrap_err();
        assert!(error.contains("at most 4096 bytes"));
        assert!(!path.exists());
    }

    #[cfg(unix)]
    #[test]
    fn custom_registration_rejects_a_native_executable_over_128_mib() {
        use std::io::Write as _;

        let dir = tempfile::tempdir().unwrap();
        let executable = dir.path().join("oversized-native-agent");
        let mut file = fs::File::create(&executable).unwrap();
        file.write_all(&[0xcf, 0xfa, 0xed, 0xfe]).unwrap();
        file.set_len(128 * 1024 * 1024 + 1).unwrap();
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o755)).unwrap();
        let executable = executable.canonicalize().unwrap();
        let registration_path = dir.path().join("assistant-agents.json");

        let error = add_registration(
            &registration_path,
            executable.to_string_lossy().into_owned(),
            vec![],
        )
        .unwrap_err();

        assert!(error.contains("128 MiB"), "unexpected error: {error}");
        assert!(!registration_path.exists());
    }

    #[cfg(unix)]
    #[test]
    fn custom_registration_requires_a_canonical_absolute_native_executable() {
        use std::os::unix::fs::symlink;

        let executable = PathBuf::from(native_test_executable());
        let dir = tempfile::tempdir().unwrap();
        let registration_path = dir.path().join("assistant-agents.json");
        let script = dir.path().join("script-agent");
        fs::write(&script, "#!/bin/sh\nexit 0\n").unwrap();
        fs::set_permissions(&script, fs::Permissions::from_mode(0o755)).unwrap();
        let symlink_path = dir.path().join("linked-agent");
        symlink(&executable, &symlink_path).unwrap();
        let noncanonical = executable
            .parent()
            .unwrap()
            .join(".")
            .join(executable.file_name().unwrap());

        for (case, command) in [
            (
                "relative",
                executable
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned(),
            ),
            (
                "directory",
                dir.path()
                    .canonicalize()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned(),
            ),
            (
                "script",
                script
                    .canonicalize()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned(),
            ),
            ("symlink", symlink_path.to_string_lossy().into_owned()),
            ("noncanonical", noncanonical.to_string_lossy().into_owned()),
            ("shell-dispatcher", "/bin/sh".into()),
            ("environment-dispatcher", "/usr/bin/env".into()),
        ] {
            let error = match add_registration(&registration_path, command.clone(), vec![]) {
                Ok(snapshot) => panic!("{case} `{command}` unexpectedly persisted: {snapshot:?}"),
                Err(error) => error,
            };
            assert!(
                error.contains("canonical absolute path")
                    || error.contains("regular native executable")
                    || error.contains("symbolic links")
                    || error.contains("directly"),
                "unexpected native executable error: {error}"
            );
            assert!(!registration_path.exists());
        }
    }

    #[test]
    fn builtins_share_one_typed_registry_and_describe_protocol_evidence() {
        let agents = builtin_agents();

        assert_eq!(agents.len(), 2);
        assert_eq!(agents[0].id, "claude-agent-acp");
        assert_eq!(agents[0].command, "claude-agent-acp");
        assert_eq!(agents[0].source, AgentSource::BuiltIn);
        assert_eq!(agents[1].id, "codex-acp");
        assert_eq!(agents[1].command, "codex-acp");
        assert!(agents.iter().all(|agent| !agent.setup_url.is_empty()));
        assert!(agents.iter().all(|agent| agent.args.is_empty()));
        assert_eq!(
            agents[0].capabilities.session_restore,
            CapabilitySupport::Advertised
        );
        assert_eq!(
            agents[0].capabilities.session_create,
            CapabilitySupport::ProtocolBaseline
        );
    }

    #[test]
    fn shared_wire_fixture_round_trips_through_the_rust_serde_contract() {
        #[derive(serde::Deserialize)]
        #[serde(rename_all = "camelCase", deny_unknown_fields)]
        struct WireFixture {
            discovery_response: DiscoveryResponse,
            registration_snapshot: RegistrationSnapshot,
        }

        let raw: serde_json::Value = serde_json::from_str(include_str!(
            "../../../shared/assistant-discovery-wire.json"
        ))
        .unwrap();
        let fixture: WireFixture = serde_json::from_value(raw.clone()).unwrap();

        assert_eq!(
            serde_json::to_value(fixture.discovery_response).unwrap(),
            raw["discoveryResponse"]
        );
        assert_eq!(
            serde_json::to_value(fixture.registration_snapshot).unwrap(),
            raw["registrationSnapshot"]
        );
    }

    #[test]
    fn registration_updates_are_versioned_and_preserve_only_command_and_args() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("assistant-agents.json");

        let command = native_test_executable();
        let first = add_registration(&path, command.clone(), vec!["--stdio".into()]).unwrap();
        assert_eq!(first.revision, 1);
        assert_eq!(first.registrations.len(), 1);
        let id = first.registrations[0].id.clone();
        assert_eq!(first.registrations[0].command, command);
        assert_eq!(first.registrations[0].args, ["--stdio"]);

        let stored = std::fs::read_to_string(&path).unwrap();
        assert!(stored.contains("\"version\": 1"));
        assert!(!stored.contains("apiKey"));
        assert!(!stored.contains("environment"));

        let removed = remove_registration(&path, &id).unwrap();
        assert_eq!(removed.revision, 2);
        assert!(removed.registrations.is_empty());
        assert_eq!(load_registrations(&path).unwrap(), removed);
    }

    #[test]
    fn registration_persists_the_canonical_native_executable_validated_for_spawning() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("assistant-agents.json");

        let command = native_test_executable();
        let snapshot = add_registration(&path, command.clone(), vec![]).unwrap();

        assert_eq!(snapshot.registrations[0].command, command);
        assert_eq!(load_registrations(&path).unwrap(), snapshot);
    }

    #[test]
    fn malformed_registration_data_is_reported_without_overwrite() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("assistant-agents.json");
        std::fs::write(&path, "not-json").unwrap();

        let error = add_registration(&path, native_test_executable(), vec![]).unwrap_err();

        assert!(error.contains("could not be read"));
        assert_eq!(std::fs::read_to_string(path).unwrap(), "not-json");
    }

    #[cfg(unix)]
    #[test]
    fn initialize_only_probe_classifies_agents_and_reaps_children() {
        tauri::async_runtime::block_on(async {
            let dir = tempfile::tempdir().unwrap();

            for (mode, expected) in [
                ("compatible", AgentStatus::Compatible),
                ("missing_restore", AgentStatus::Incompatible),
                ("auth_required", AgentStatus::AuthenticationRequired),
                ("malformed", AgentStatus::HandshakeFailed),
                ("wrong_id", AgentStatus::HandshakeFailed),
            ] {
                let executable = build_native_fake_agent(dir.path(), mode);
                let log = fake_agent_artifact_path(&executable, "requests");
                let pid = fake_agent_artifact_path(&executable, "pids");
                let started = std::time::Instant::now();
                let result = super::probe_agent(
                    &executable.to_string_lossy(),
                    &["--stdio".into()],
                    Duration::from_secs(5),
                )
                .await;

                assert!(
                    started.elapsed() < Duration::from_secs(6),
                    "mode {mode} exceeded its supervisor bound"
                );
                assert_eq!(result.status, expected, "mode {mode}: {result:?}");
                let requests = std::fs::read_to_string(&log).unwrap();
                assert!(requests.contains("\"method\":\"initialize\""));
                assert!(!requests.contains("session/new"));
                std::fs::remove_file(log).unwrap();
                assert_process_is_gone(&pid);
            }
        });
    }

    #[cfg(unix)]
    #[test]
    fn timed_out_probe_reaps_the_agent_process() {
        tauri::async_runtime::block_on(async {
            let dir = tempfile::tempdir().unwrap();
            let executable = build_native_fake_agent(dir.path(), "hang");
            let pid = fake_agent_artifact_path(&executable, "pids");

            let started = std::time::Instant::now();
            let result = super::probe_agent(
                &executable.to_string_lossy(),
                &["--stdio".into()],
                Duration::from_millis(100),
            )
            .await;

            assert!(started.elapsed() < Duration::from_secs(1));
            assert_eq!(result.status, AgentStatus::HandshakeFailed);
            assert!(result.message.contains("timed out"));
            assert_process_is_gone(&pid);
        });
    }

    #[cfg(unix)]
    #[test]
    fn superseded_probe_is_cancelled_and_reaped() {
        tauri::async_runtime::block_on(async {
            let dir = tempfile::tempdir().unwrap();
            let executable = build_native_fake_agent(dir.path(), "hang");
            let pid = fake_agent_artifact_path(&executable, "pids");
            let epoch = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(1));
            let next_epoch = epoch.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(50)).await;
                next_epoch.store(2, std::sync::atomic::Ordering::Release);
            });

            let started = std::time::Instant::now();
            let result = super::probe_agent_for_epoch(
                &executable.to_string_lossy(),
                &["--stdio".into()],
                Duration::from_secs(5),
                epoch,
                1,
            )
            .await;

            assert!(started.elapsed() < Duration::from_secs(1));
            assert_eq!(result.status, AgentStatus::HandshakeFailed);
            assert!(result.message.contains("superseded"));
            assert_process_is_gone(&pid);
        });
    }

    #[cfg(unix)]
    #[test]
    fn discovery_merges_builtins_and_custom_agents_without_catalog_wide_failure() {
        tauri::async_runtime::block_on(async {
            let dir = tempfile::tempdir().unwrap();
            let executable = build_native_fake_agent(dir.path(), "compatible");
            let pid = fake_agent_artifact_path(&executable, "pids");
            let registration_path = dir.path().join("assistant-agents.json");
            let snapshot = super::add_registration(
                &registration_path,
                executable.to_string_lossy().into_owned(),
                vec!["--stdio".into()],
            )
            .unwrap();
            let custom_id = snapshot.registrations[0].id.clone();

            let response =
                super::discover_agents("/workspace".into(), snapshot, None, Duration::from_secs(5))
                    .await;

            assert_eq!(response.workspace_root, "/workspace");
            assert_eq!(response.registration_revision, 1);
            assert_eq!(response.agents.len(), 3);
            assert_eq!(response.agents[2].id, custom_id);
            assert_eq!(response.agents[2].status, AgentStatus::Compatible);
            assert_eq!(response.agents[0].id, "claude-agent-acp");
            assert_eq!(response.agents[1].id, "codex-acp");
            assert_process_is_gone(&pid);
        });
    }

    #[cfg(unix)]
    fn assert_process_is_gone(pid_path: &std::path::Path) {
        let pids = match std::fs::read_to_string(pid_path) {
            Ok(pids) => pids,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
            Err(error) => panic!("could not read probe pid fixture: {error}"),
        };
        for pid in pids.lines() {
            let status = std::process::Command::new("/bin/kill")
                .args(["-0", pid])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .unwrap();
            assert!(!status.success(), "probe left child {pid} running");
        }
        std::fs::remove_file(pid_path).unwrap();
        let request_path = pid_path.with_extension("requests");
        if let Err(error) = std::fs::remove_file(request_path) {
            assert_eq!(error.kind(), std::io::ErrorKind::NotFound);
        }
    }
}

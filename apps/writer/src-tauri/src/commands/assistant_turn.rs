use crate::assistant::{
    append_completed_turn, bind_custom_executable, builtin_agents, create_conversation,
    delete_conversation, grant_consent, is_session_restore_error, list_workspace_conversations,
    load_consents, load_conversation_for_workspace, load_registrations,
    mark_session_restore_failed, remember_last_agent, rename_conversation, run_agent_turn,
    run_bound_agent_turn, select_conversation, unix_millis, AgentDefinition, AgentSource,
    BindingControl, ConsentStatus, ConversationRecord, ConversationRestoreStatus,
    FrontendLeaseIdentity, LifecycleRequest, PersistedPermissionDecision, PrepareAcknowledgement,
    PrepareResult, ReconcileAcknowledgement, RuntimeChannels, RuntimeOutcome,
    RuntimePermissionRequest, RuntimeUpdate, TurnPermissionOption, TurnPersistenceInput, TurnPhase,
    TurnReservation, WorkspaceConversationSnapshot,
};
use crate::state::{AppState, WorkspaceState};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, Manager, Runtime, WebviewWindow};

const CONSENT_FILE_NAME: &str = "assistant-consents.json";
const REGISTRATION_FILE_NAME: &str = "assistant-agents.json";
const MAX_PROMPT_BYTES: usize = 64 * 1024;
const LIFECYCLE_TIMEOUT: Duration = Duration::from_secs(60);
const TURN_TIMEOUT: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnBridgeRegistration {
    pub bridge_id: String,
    pub workspace_root: String,
    pub workspace_epoch: u64,
    pub frontend_generation: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartAgentTurnResponse {
    pub turn_id: String,
    pub conversation_id: String,
    pub workspace_root: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "kebab-case",
    rename_all_fields = "camelCase"
)]
pub enum AgentTurnEvent {
    Prepare {
        turn_id: String,
        conversation_id: String,
        workspace_root: String,
        workspace_epoch: u64,
        participant_token: String,
        bridge_id: String,
        request_id: String,
    },
    Reconcile {
        turn_id: String,
        conversation_id: String,
        workspace_root: String,
        workspace_epoch: u64,
        participant_token: String,
        bridge_id: String,
        request_id: String,
        lease: FrontendLeaseIdentity,
    },
    Phase {
        turn_id: String,
        conversation_id: String,
        workspace_root: String,
        phase: TurnPhase,
    },
    StreamText {
        turn_id: String,
        conversation_id: String,
        workspace_root: String,
        text: String,
    },
    ChangeSummary {
        turn_id: String,
        conversation_id: String,
        workspace_root: String,
        summary: String,
    },
    Permission {
        turn_id: String,
        conversation_id: String,
        workspace_root: String,
        request_id: String,
        title: String,
        options: Vec<TurnPermissionOption>,
    },
    Terminal {
        turn_id: String,
        conversation_id: String,
        workspace_root: String,
        status: String,
        message: String,
    },
    ReconciliationBlocked {
        turn_id: String,
        conversation_id: String,
        workspace_root: String,
        message: String,
    },
}

#[tauri::command]
pub fn register_agent_turn_bridge(
    workspace_root: String,
    frontend_generation: u64,
    expected_bridge_id: Option<String>,
    window: WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<TurnBridgeRegistration, String> {
    register_agent_turn_bridge_core(
        workspace_root,
        frontend_generation,
        expected_bridge_id.as_deref(),
        window.label(),
        &state,
    )
}

#[tauri::command]
pub fn unregister_agent_turn_bridge(
    workspace_root: String,
    bridge_id: String,
    window: WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> bool {
    unregister_agent_turn_bridge_core(&workspace_root, &bridge_id, window.label(), &state)
}

fn unregister_agent_turn_bridge_core(
    workspace_root: &str,
    bridge_id: &str,
    window_label: &str,
    state: &AppState,
) -> bool {
    state
        .agent_coordinator
        .unregister_bridge(window_label, Path::new(workspace_root), bridge_id)
}

#[tauri::command]
pub fn list_assistant_conversations(
    workspace_root: String,
    window: WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<WorkspaceConversationSnapshot, String> {
    list_assistant_conversations_core(workspace_root, window.label(), app_data_dir(&app)?, &state)
}

#[tauri::command]
pub fn create_assistant_conversation(
    workspace_root: String,
    agent_id: String,
    name: Option<String>,
    window: WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ConversationRecord, String> {
    create_assistant_conversation_core(
        workspace_root,
        agent_id,
        name,
        window.label(),
        app_data_dir(&app)?,
        &state,
    )
}

#[tauri::command]
pub fn rename_assistant_conversation(
    workspace_root: String,
    conversation_id: String,
    name: String,
    window: WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ConversationRecord, String> {
    rename_assistant_conversation_core(
        workspace_root,
        conversation_id,
        name,
        window.label(),
        app_data_dir(&app)?,
        &state,
    )
}

#[tauri::command]
pub fn select_assistant_conversation(
    workspace_root: String,
    conversation_id: String,
    window: WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ConversationRecord, String> {
    select_assistant_conversation_core(
        workspace_root,
        conversation_id,
        window.label(),
        app_data_dir(&app)?,
        &state,
    )
}

#[tauri::command]
pub fn delete_assistant_conversation(
    workspace_root: String,
    conversation_id: String,
    window: WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<WorkspaceConversationSnapshot, String> {
    delete_assistant_conversation_core(
        workspace_root,
        conversation_id,
        window.label(),
        app_data_dir(&app)?,
        &state,
    )
}

#[tauri::command]
pub fn remember_assistant_agent(
    workspace_root: String,
    agent_id: String,
    window: WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    remember_assistant_agent_core(
        workspace_root,
        agent_id,
        window.label(),
        app_data_dir(&app)?,
        &state,
    )
}

#[tauri::command]
#[allow(clippy::too_many_arguments)] // Tauri serializes these named IPC fields individually.
pub fn start_agent_turn(
    workspace_root: String,
    agent_id: String,
    registration_revision: u64,
    conversation_id: String,
    prompt: String,
    window: WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<StartAgentTurnResponse, String> {
    start_agent_turn_core(
        workspace_root,
        agent_id,
        registration_revision,
        conversation_id,
        prompt,
        window.label(),
        app.clone(),
        consent_path(&app)?,
        registration_path(&app)?,
        app_data_dir(&app)?,
        &state,
        LIFECYCLE_TIMEOUT,
    )
}

#[tauri::command]
pub fn acknowledge_agent_turn_prepared(
    acknowledgement: PrepareAcknowledgement,
    window: WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<PrepareResultWire, String> {
    acknowledge_agent_turn_prepared_core(window.label(), acknowledgement, &state)
}

#[tauri::command]
pub fn acknowledge_agent_turn_reconciled(
    acknowledgement: ReconcileAcknowledgement,
    window: WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    acknowledge_agent_turn_reconciled_core(window.label(), acknowledgement, &state)
}

#[tauri::command]
pub fn respond_agent_turn_permission(
    workspace_root: String,
    turn_id: String,
    request_id: String,
    option_id: Option<String>,
    window: WebviewWindow,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    respond_agent_turn_permission_core(
        workspace_root,
        turn_id,
        request_id,
        option_id,
        window.label(),
        &state,
    )
}

fn respond_agent_turn_permission_core(
    workspace_root: String,
    turn_id: String,
    request_id: String,
    option_id: Option<String>,
    window_label: &str,
    state: &AppState,
) -> Result<(), String> {
    let canonical_root = validate_workspace_request(
        &workspace_root,
        &state.get_or_create(window_label),
        "answering the Agent permission request",
    )?;
    let turn = state
        .agent_coordinator
        .active(Path::new(&canonical_root), &turn_id)?;
    turn.respond_permission(window_label, &request_id, option_id)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PrepareResultWire {
    Ready,
    Failed,
    Pending,
}

fn register_agent_turn_bridge_core(
    workspace_root: String,
    frontend_generation: u64,
    expected_bridge_id: Option<&str>,
    window_label: &str,
    state: &AppState,
) -> Result<TurnBridgeRegistration, String> {
    let window_state = state.get_or_create(window_label);
    let canonical_root = validate_workspace_request(
        &workspace_root,
        &window_state,
        "registering the Agent Turn event bridge",
    )?;
    let workspace_epoch = window_state.workspace_epoch.load(Ordering::Acquire);
    let bridge_id = state.agent_coordinator.register_bridge_cas(
        window_label,
        PathBuf::from(&canonical_root),
        workspace_epoch,
        frontend_generation,
        expected_bridge_id,
    )?;
    Ok(TurnBridgeRegistration {
        bridge_id,
        workspace_root: canonical_root,
        workspace_epoch,
        frontend_generation,
    })
}

fn list_assistant_conversations_core(
    workspace_root: String,
    window_label: &str,
    app_data_dir: PathBuf,
    state: &AppState,
) -> Result<WorkspaceConversationSnapshot, String> {
    let canonical_root = validate_workspace_request(
        &workspace_root,
        &state.get_or_create(window_label),
        "listing Assistant Conversations",
    )?;
    let _guard = state.assistant_conversations_lock.lock();
    list_workspace_conversations(&app_data_dir, &canonical_root)
}

fn create_assistant_conversation_core(
    workspace_root: String,
    agent_id: String,
    name: Option<String>,
    window_label: &str,
    app_data_dir: PathBuf,
    state: &AppState,
) -> Result<ConversationRecord, String> {
    let canonical_root = validate_workspace_request(
        &workspace_root,
        &state.get_or_create(window_label),
        "creating an Assistant Conversation",
    )?;
    // Consent is not required to create a conversation shell; AI turns still require it.
    let _guard = state.assistant_conversations_lock.lock();
    create_conversation(&app_data_dir, canonical_root, agent_id, name)
}

fn rename_assistant_conversation_core(
    workspace_root: String,
    conversation_id: String,
    name: String,
    window_label: &str,
    app_data_dir: PathBuf,
    state: &AppState,
) -> Result<ConversationRecord, String> {
    let canonical_root = validate_workspace_request(
        &workspace_root,
        &state.get_or_create(window_label),
        "renaming an Assistant Conversation",
    )?;
    let _guard = state.assistant_conversations_lock.lock();
    rename_conversation(&app_data_dir, &canonical_root, &conversation_id, name)
}

fn select_assistant_conversation_core(
    workspace_root: String,
    conversation_id: String,
    window_label: &str,
    app_data_dir: PathBuf,
    state: &AppState,
) -> Result<ConversationRecord, String> {
    let canonical_root = validate_workspace_request(
        &workspace_root,
        &state.get_or_create(window_label),
        "selecting an Assistant Conversation",
    )?;
    let _guard = state.assistant_conversations_lock.lock();
    select_conversation(&app_data_dir, &canonical_root, &conversation_id)
}

fn delete_assistant_conversation_core(
    workspace_root: String,
    conversation_id: String,
    window_label: &str,
    app_data_dir: PathBuf,
    state: &AppState,
) -> Result<WorkspaceConversationSnapshot, String> {
    let canonical_root = validate_workspace_request(
        &workspace_root,
        &state.get_or_create(window_label),
        "deleting an Assistant Conversation",
    )?;
    state.reject_workspace_mutation_if_active(Path::new(&canonical_root))?;
    let _guard = state.assistant_conversations_lock.lock();
    delete_conversation(&app_data_dir, &canonical_root, &conversation_id)
}

fn remember_assistant_agent_core(
    workspace_root: String,
    agent_id: String,
    window_label: &str,
    app_data_dir: PathBuf,
    state: &AppState,
) -> Result<(), String> {
    let canonical_root = validate_workspace_request(
        &workspace_root,
        &state.get_or_create(window_label),
        "remembering the selected Agent",
    )?;
    let _guard = state.assistant_conversations_lock.lock();
    remember_last_agent(&app_data_dir, &canonical_root, &agent_id)
}

#[allow(clippy::too_many_arguments)]
fn start_agent_turn_core<R: Runtime>(
    workspace_root: String,
    agent_id: String,
    registration_revision: u64,
    conversation_id: String,
    prompt: String,
    window_label: &str,
    app: tauri::AppHandle<R>,
    consent_path: PathBuf,
    registration_path: PathBuf,
    app_data_dir: PathBuf,
    state: &AppState,
    lifecycle_timeout: Duration,
) -> Result<StartAgentTurnResponse, String> {
    if conversation_id.is_empty()
        || conversation_id.len() > 128
        || !conversation_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err(
            "The Assistant Conversation identity must be 1-128 ASCII letters, digits, '.', '_' or '-'.".into(),
        );
    }
    if prompt.trim().is_empty() || prompt.len() > MAX_PROMPT_BYTES {
        return Err(format!(
            "An Agent prompt must contain 1 to {MAX_PROMPT_BYTES} bytes."
        ));
    }
    let canonical_root = validate_workspace_request(
        &workspace_root,
        &state.get_or_create(window_label),
        "starting the Agent Turn",
    )?;
    {
        let _guard = state.assistant_consents_lock.lock();
        let consent = load_consents(&consent_path)?;
        if !consent
            .workspaces
            .iter()
            .any(|root| root == &canonical_root)
        {
            return Err(
                "Enable AI Access for this Workspace before starting an Agent Turn.".into(),
            );
        }
    }
    let existing_session_id = {
        let _guard = state.assistant_conversations_lock.lock();
        let record =
            load_conversation_for_workspace(&app_data_dir, &canonical_root, &conversation_id)?;
        if record.agent_id != agent_id {
            return Err(
                "This Assistant Conversation is permanently bound to a different Agent Runtime; create a new Conversation to change Runtimes."
                    .into(),
            );
        }
        if record.restore_status == ConversationRestoreStatus::Failed {
            return Err(
                "This Assistant Conversation cannot resume its Runtime session; create a new Conversation instead of replaying history."
                    .into(),
            );
        }
        record.runtime_session_id
    };
    let _registrations_guard = state.assistant_registrations_lock.lock();
    let agent = validate_agent_selection(&agent_id, registration_revision, &registration_path)?;

    let root = PathBuf::from(&canonical_root);
    let windows = state.workspace_incarnations(&root);
    let reservation = state.agent_coordinator.reserve(root, &windows)?;
    let response = StartAgentTurnResponse {
        turn_id: reservation.turn_id().to_string(),
        conversation_id: conversation_id.clone(),
        workspace_root: canonical_root,
    };
    tauri::async_runtime::spawn(drive_preparation(
        app,
        reservation,
        agent,
        prompt,
        conversation_id,
        existing_session_id,
        app_data_dir,
        lifecycle_timeout,
        TURN_TIMEOUT,
    ));
    Ok(response)
}

fn validate_agent_selection(
    agent_id: &str,
    registration_revision: u64,
    registration_path: &Path,
) -> Result<AgentDefinition, String> {
    if let Some(agent) = builtin_agents()
        .into_iter()
        .find(|agent| agent.id == agent_id)
    {
        return Ok(agent);
    }
    let snapshot = load_registrations(registration_path)?;
    if snapshot.revision != registration_revision {
        return Err(
            "The selected custom Agent changed after discovery; refresh and choose it again."
                .into(),
        );
    }
    if let Some(registration) = snapshot
        .registrations
        .into_iter()
        .find(|registration| registration.id == agent_id)
    {
        Ok(AgentDefinition {
            id: registration.id,
            name: "Custom ACP Agent".into(),
            source: AgentSource::Custom,
            command: registration.command,
            args: registration.args,
            setup_url: String::new(),
            capabilities: Default::default(),
        })
    } else {
        Err("The selected compatible Agent is no longer registered.".into())
    }
}

fn acknowledge_agent_turn_prepared_core(
    window_label: &str,
    acknowledgement: PrepareAcknowledgement,
    state: &AppState,
) -> Result<PrepareResultWire, String> {
    validate_acknowledgement_incarnation(
        window_label,
        &acknowledgement.workspace_root,
        acknowledgement.workspace_epoch,
        state,
    )?;
    let turn = state.agent_coordinator.active(
        Path::new(&acknowledgement.workspace_root),
        &acknowledgement.turn_id,
    )?;
    turn.acknowledge_prepare(window_label, acknowledgement)
        .map(PrepareResultWire::from)
}

fn acknowledge_agent_turn_reconciled_core(
    window_label: &str,
    acknowledgement: ReconcileAcknowledgement,
    state: &AppState,
) -> Result<bool, String> {
    validate_acknowledgement_incarnation(
        window_label,
        &acknowledgement.workspace_root,
        acknowledgement.workspace_epoch,
        state,
    )?;
    let turn = state.agent_coordinator.active(
        Path::new(&acknowledgement.workspace_root),
        &acknowledgement.turn_id,
    )?;
    turn.acknowledge_reconcile(window_label, acknowledgement)
}

fn validate_acknowledgement_incarnation(
    window_label: &str,
    workspace_root: &str,
    workspace_epoch: u64,
    state: &AppState,
) -> Result<(), String> {
    let window_state = state
        .get(window_label)
        .ok_or_else(|| "The invoking Writer window no longer exists.".to_string())?;
    if window_state.workspace_root.read().as_deref() != Some(Path::new(workspace_root))
        || window_state.workspace_epoch.load(Ordering::Acquire) != workspace_epoch
    {
        return Err(
            "The Writer window changed Workspace before acknowledging the Agent Turn.".into(),
        );
    }
    Ok(())
}

impl From<PrepareResult> for PrepareResultWire {
    fn from(value: PrepareResult) -> Self {
        match value {
            PrepareResult::Ready => Self::Ready,
            PrepareResult::Failed(_) => Self::Failed,
            PrepareResult::Pending => Self::Pending,
        }
    }
}

async fn drive_preparation<R: Runtime>(
    app: tauri::AppHandle<R>,
    turn: TurnReservation,
    agent: AgentDefinition,
    prompt: String,
    conversation_id: String,
    existing_session_id: Option<String>,
    app_data_dir: PathBuf,
    lifecycle_timeout: Duration,
    turn_timeout: Duration,
) {
    let prepare_requests = turn.prepare_requests();
    let window_labels = prepare_requests
        .iter()
        .map(|request| request.window_label.clone())
        .collect::<Vec<_>>();
    let started_at = unix_millis();
    for request in &prepare_requests {
        if let Err(error) = app.emit_to(
            &request.window_label,
            "assistant:turn-event",
            prepare_event(request, &conversation_id),
        ) {
            let _ = turn.acknowledge_prepare(
                &request.window_label,
                PrepareAcknowledgement {
                    turn_id: request.turn_id.clone(),
                    workspace_root: request.workspace_root.clone(),
                    workspace_epoch: request.workspace_epoch,
                    participant_token: request.participant_token.clone(),
                    bridge_id: request.bridge_id.clone(),
                    request_id: request.request_id.clone(),
                    lease: None,
                    error: Some(format!("Could not deliver Workspace preparation: {error}")),
                },
            );
        }
    }

    let mut cancellation = turn.cancellation_receiver();
    let preparation = tokio::select! {
        result = turn.wait_for_preparation(lifecycle_timeout) => result,
        _ = cancellation.changed() => Err("Agent Turn cancelled because a Workspace window closed.".into()),
    };
    let runtime_result = match preparation {
        Ok(PrepareResult::Failed(error)) => Err(error),
        Ok(PrepareResult::Ready) => {
            if let Err(error) = turn.mark_running() {
                Err(error)
            } else {
                emit_phase(
                    &app,
                    &turn,
                    &window_labels,
                    &conversation_id,
                    TurnPhase::Running,
                );
                run_selected_agent(
                    &app,
                    &turn,
                    &window_labels,
                    agent,
                    prompt.clone(),
                    &conversation_id,
                    existing_session_id.as_deref(),
                    turn_timeout,
                )
                .await
            }
        }
        Ok(PrepareResult::Pending) => unreachable!(),
        Err(error) => Err(error),
    };

    turn.cancel_pending_permission();
    let permission_decisions = turn
        .permission_decisions()
        .into_iter()
        .map(|decision| PersistedPermissionDecision {
            request_id: decision.request_id,
            title: decision.title,
            option_id: decision.option_id,
            decided_at: unix_millis(),
        })
        .collect::<Vec<_>>();
    let reconcile_requests = turn.begin_reconciliation();
    emit_phase(
        &app,
        &turn,
        &window_labels,
        &conversation_id,
        TurnPhase::Reconciling,
    );
    for request in &reconcile_requests {
        if let Some(lease) = request.lease.clone() {
            let _ = app.emit_to(
                &request.window_label,
                "assistant:turn-event",
                reconcile_event(request, &conversation_id, lease),
            );
        }
    }

    let reconciliation = match turn.wait_for_reconciliation(lifecycle_timeout).await {
        Ok(()) => Ok(()),
        Err(error) => {
            let message = format!(
                "{error} Writer is keeping this Workspace read-only; close or switch this window to withdraw the blocked participant. Partial Agent changes remain on disk."
            );
            for window_label in &window_labels {
                let _ = app.emit_to(
                    window_label,
                    "assistant:turn-event",
                    AgentTurnEvent::ReconciliationBlocked {
                        turn_id: turn.turn_id().to_string(),
                        conversation_id: conversation_id.clone(),
                        workspace_root: turn.workspace_root().to_string_lossy().into_owned(),
                        message: message.clone(),
                    },
                );
            }
            loop {
                let release = tokio::select! {
                    result = turn.wait_for_reconciliation_release(lifecycle_timeout) => result,
                    _ = cancellation.changed() => {
                        Err("Agent Turn reconciliation was released because its final Workspace participant closed.".into())
                    },
                };
                match release {
                    Ok(()) => break Err(error),
                    Err(release_error) if *cancellation.borrow() => break Err(release_error),
                    Err(_) => continue,
                }
            }
        }
    };
    let reconciliation_failed = turn.reconciliation_failed();
    let reconciliation_succeeded = reconciliation.is_ok();
    let restore_failed = runtime_result
        .as_ref()
        .err()
        .is_some_and(|error| is_session_restore_error(error));
    let (status, message, outcome_for_persist) = match (runtime_result, reconciliation) {
        (Ok(_), Ok(())) if reconciliation_failed => (
            "failed",
            "The Agent finished, but Writer could not reload every changed Workspace item. Partial changes remain on disk."
                .into(),
            None,
        ),
        (Ok(outcome), Ok(())) => {
            let message = completed_message(&outcome);
            ("completed", message, Some(outcome))
        }
        (Err(error), Ok(())) if restore_failed || is_session_restore_error(&error) => (
            "failed",
            format!(
                "Could not resume the Runtime session for this Conversation. Writer kept the local transcript; create a new Conversation instead of replaying history. {error}"
            ),
            None,
        ),
        (Err(error), Ok(())) => ("failed", failure_message(&error), None),
        (Ok(outcome), Err(error)) => ("failed", failure_message(&error), Some(outcome)),
        (Err(runtime), Err(reconcile)) => (
            "failed",
            failure_message(&format!("{runtime} {reconcile}")),
            None,
        ),
    };
    let finished_at = unix_millis();
    let workspace_root = turn.workspace_root().to_string_lossy().into_owned();
    {
        let state = app.state::<AppState>();
        let _guard = state.assistant_conversations_lock.lock();
        if restore_failed {
            let _ = mark_session_restore_failed(&app_data_dir, &workspace_root, &conversation_id);
        } else if status == "completed" || outcome_for_persist.is_some() {
            let final_reply = outcome_for_persist
                .as_ref()
                .map(|outcome| outcome.output.clone())
                .unwrap_or_default();
            let change_summaries = outcome_for_persist
                .as_ref()
                .map(|outcome| outcome.change_summaries.clone())
                .unwrap_or_default();
            let runtime_session_id = outcome_for_persist
                .as_ref()
                .and_then(|outcome| outcome.session_id.clone());
            let _ = append_completed_turn(
                &app_data_dir,
                &workspace_root,
                &conversation_id,
                TurnPersistenceInput {
                    turn_id: turn.turn_id().to_string(),
                    prompt,
                    final_reply,
                    status: status.into(),
                    outcome_message: message.clone(),
                    change_summaries,
                    permission_decisions,
                    runtime_session_id,
                    started_at,
                    finished_at,
                },
            );
        } else if !prompt.is_empty() {
            // Persist a failed turn that still produced a user prompt so history is auditable.
            let _ = append_completed_turn(
                &app_data_dir,
                &workspace_root,
                &conversation_id,
                TurnPersistenceInput {
                    turn_id: turn.turn_id().to_string(),
                    prompt,
                    final_reply: String::new(),
                    status: status.into(),
                    outcome_message: message.clone(),
                    change_summaries: Vec::new(),
                    permission_decisions,
                    runtime_session_id: None,
                    started_at,
                    finished_at,
                },
            );
        }
    }
    for window_label in window_labels {
        let _ = app.emit_to(
            window_label,
            "assistant:turn-event",
            AgentTurnEvent::Terminal {
                turn_id: turn.turn_id().to_string(),
                conversation_id: conversation_id.clone(),
                workspace_root: prepare_requests
                    .first()
                    .map(|request| request.workspace_root.clone())
                    .unwrap_or_default(),
                status: status.into(),
                message: message.clone(),
            },
        );
    }
    if reconciliation_succeeded {
        let coordinator = &app.state::<AppState>().agent_coordinator;
        let _ = coordinator.finish(&turn);
    }
}

#[allow(clippy::too_many_arguments)]
async fn run_selected_agent<R: Runtime>(
    app: &tauri::AppHandle<R>,
    turn: &TurnReservation,
    window_labels: &[String],
    agent: AgentDefinition,
    prompt: String,
    conversation_id: &str,
    existing_session_id: Option<&str>,
    deadline: Duration,
) -> Result<RuntimeOutcome, String> {
    let workspace_root = turn.workspace_root().to_path_buf();
    let cancellation = turn.cancellation_receiver();
    let (update_tx, mut update_rx) = tokio::sync::mpsc::unbounded_channel();
    let (permission_tx, mut permission_rx) = tokio::sync::mpsc::unbounded_channel();
    let command = agent.command.clone();
    let args = agent.args.clone();
    let existing_session_id = existing_session_id.map(str::to_owned);
    let runtime = async move {
        match agent.source {
            AgentSource::BuiltIn => {
                run_agent_turn(
                    Path::new(&command),
                    &args,
                    &workspace_root,
                    &prompt,
                    existing_session_id.as_deref(),
                    RuntimeChannels {
                        updates: update_tx,
                        permissions: permission_tx,
                    },
                    cancellation,
                    deadline,
                )
                .await
            }
            AgentSource::Custom => {
                if *cancellation.borrow() {
                    return Err("Agent Turn cancelled because a Workspace window closed.".into());
                }
                let binding_args = args.clone();
                let binding_epoch = Arc::new(AtomicU64::new(0));
                let cancellation_epoch = binding_epoch.clone();
                let mut binding_cancellation = cancellation.clone();
                let cancellation_task = tokio::spawn(async move {
                    if *binding_cancellation.borrow()
                        || binding_cancellation.changed().await.is_ok()
                    {
                        cancellation_epoch.store(1, Ordering::Release);
                    }
                });
                let binding_control = BindingControl::for_turn((binding_epoch, 0));
                let binding_result = tokio::task::spawn_blocking(move || {
                    bind_custom_executable(&command, &binding_args, &binding_control)
                })
                .await;
                cancellation_task.abort();
                let binding = binding_result
                    .map_err(|error| format!("Custom Agent binding task failed: {error}"))??
                    .ok_or_else(|| {
                        "The selected custom Agent executable is missing.".to_string()
                    })?;
                run_bound_agent_turn(
                    binding,
                    &args,
                    &workspace_root,
                    &prompt,
                    existing_session_id.as_deref(),
                    RuntimeChannels {
                        updates: update_tx,
                        permissions: permission_tx,
                    },
                    cancellation,
                    deadline,
                )
                .await
            }
        }
    };
    tokio::pin!(runtime);
    let mut updates_open = true;
    let mut permissions_open = true;
    loop {
        tokio::select! {
            result = &mut runtime => {
                while let Ok(update) = update_rx.try_recv() {
                    emit_runtime_update(app, turn, window_labels, conversation_id, update);
                }
                return result;
            },
            update = update_rx.recv(), if updates_open => match update {
                Some(update) => emit_runtime_update(app, turn, window_labels, conversation_id, update),
                None => updates_open = false,
            },
            permission = permission_rx.recv(), if permissions_open => match permission {
                Some(permission) => emit_permission_request(app, turn, window_labels, conversation_id, permission)?,
                None => permissions_open = false,
            }
        }
    }
}

fn emit_permission_request<R: Runtime>(
    app: &tauri::AppHandle<R>,
    turn: &TurnReservation,
    window_labels: &[String],
    conversation_id: &str,
    request: RuntimePermissionRequest,
) -> Result<(), String> {
    let permission = turn.begin_permission(
        request.title,
        request
            .options
            .into_iter()
            .map(|option| TurnPermissionOption {
                id: option.id,
                name: option.name,
                kind: option.kind,
            })
            .collect(),
        request.response,
    )?;
    emit_phase(
        app,
        turn,
        window_labels,
        conversation_id,
        TurnPhase::AwaitingPermission,
    );
    let event = AgentTurnEvent::Permission {
        turn_id: turn.turn_id().into(),
        conversation_id: conversation_id.into(),
        workspace_root: turn.workspace_root().to_string_lossy().into_owned(),
        request_id: permission.request_id,
        title: permission.title,
        options: permission.options,
    };
    for window_label in window_labels {
        let _ = app.emit_to(window_label, "assistant:turn-event", event.clone());
    }
    Ok(())
}

fn emit_runtime_update<R: Runtime>(
    app: &tauri::AppHandle<R>,
    turn: &TurnReservation,
    window_labels: &[String],
    conversation_id: &str,
    update: RuntimeUpdate,
) {
    let event = match update {
        RuntimeUpdate::PermissionResolved => {
            emit_phase(
                app,
                turn,
                window_labels,
                conversation_id,
                TurnPhase::Running,
            );
            return;
        }
        RuntimeUpdate::Text(text) => AgentTurnEvent::StreamText {
            turn_id: turn.turn_id().into(),
            conversation_id: conversation_id.into(),
            workspace_root: turn.workspace_root().to_string_lossy().into_owned(),
            text,
        },
        RuntimeUpdate::ChangeSummary(summary) => AgentTurnEvent::ChangeSummary {
            turn_id: turn.turn_id().into(),
            conversation_id: conversation_id.into(),
            workspace_root: turn.workspace_root().to_string_lossy().into_owned(),
            summary,
        },
    };
    for window_label in window_labels {
        let _ = app.emit_to(window_label, "assistant:turn-event", event.clone());
    }
}

fn emit_phase<R: Runtime>(
    app: &tauri::AppHandle<R>,
    turn: &TurnReservation,
    window_labels: &[String],
    conversation_id: &str,
    phase: TurnPhase,
) {
    let event = AgentTurnEvent::Phase {
        turn_id: turn.turn_id().into(),
        conversation_id: conversation_id.into(),
        workspace_root: turn.workspace_root().to_string_lossy().into_owned(),
        phase,
    };
    for window_label in window_labels {
        let _ = app.emit_to(window_label, "assistant:turn-event", event.clone());
    }
}

fn completed_message(outcome: &RuntimeOutcome) -> String {
    if outcome.output.is_empty() {
        "Agent Turn completed.".into()
    } else {
        outcome.output.clone()
    }
}

fn failure_message(error: &str) -> String {
    format!(
        "{error} If the Agent wrote files, those partial changes remain; Writer does not roll them back."
    )
}

fn prepare_event(request: &LifecycleRequest, conversation_id: &str) -> AgentTurnEvent {
    AgentTurnEvent::Prepare {
        turn_id: request.turn_id.clone(),
        conversation_id: conversation_id.into(),
        workspace_root: request.workspace_root.clone(),
        workspace_epoch: request.workspace_epoch,
        participant_token: request.participant_token.clone(),
        bridge_id: request.bridge_id.clone(),
        request_id: request.request_id.clone(),
    }
}

fn reconcile_event(
    request: &LifecycleRequest,
    conversation_id: &str,
    lease: FrontendLeaseIdentity,
) -> AgentTurnEvent {
    AgentTurnEvent::Reconcile {
        turn_id: request.turn_id.clone(),
        conversation_id: conversation_id.into(),
        workspace_root: request.workspace_root.clone(),
        workspace_epoch: request.workspace_epoch,
        participant_token: request.participant_token.clone(),
        bridge_id: request.bridge_id.clone(),
        request_id: request.request_id.clone(),
        lease,
    }
}

#[tauri::command]
pub fn get_ai_access_consent(
    workspace_root: String,
    window: WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ConsentStatus, String> {
    get_ai_access_consent_core(workspace_root, window.label(), consent_path(&app)?, &state)
}

#[tauri::command]
pub fn grant_ai_access_consent(
    workspace_root: String,
    window: WebviewWindow,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<ConsentStatus, String> {
    grant_ai_access_consent_core(workspace_root, window.label(), consent_path(&app)?, &state)
}

fn get_ai_access_consent_core(
    workspace_root: String,
    window_label: &str,
    path: PathBuf,
    state: &AppState,
) -> Result<ConsentStatus, String> {
    let canonical_root = validate_workspace_request(
        &workspace_root,
        &state.get_or_create(window_label),
        "checking AI Access Consent",
    )?;
    let snapshot = load_consents(&path)?;
    Ok(status(canonical_root, &snapshot))
}

fn grant_ai_access_consent_core(
    workspace_root: String,
    window_label: &str,
    path: PathBuf,
    state: &AppState,
) -> Result<ConsentStatus, String> {
    let canonical_root = validate_workspace_request(
        &workspace_root,
        &state.get_or_create(window_label),
        "granting AI Access Consent",
    )?;
    let _guard = state.assistant_consents_lock.lock();
    let snapshot = grant_consent(&path, canonical_root.clone())?;
    Ok(status(canonical_root, &snapshot))
}

fn status(workspace_root: String, snapshot: &crate::assistant::ConsentSnapshot) -> ConsentStatus {
    ConsentStatus {
        granted: snapshot
            .workspaces
            .iter()
            .any(|root| root == &workspace_root),
        workspace_root,
        revision: snapshot.revision,
    }
}

fn consent_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(CONSENT_FILE_NAME))
        .map_err(|error| format!("Could not resolve AI Access Consent storage: {error}"))
}

fn registration_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(REGISTRATION_FILE_NAME))
        .map_err(|error| format!("Could not resolve Agent registration storage: {error}"))
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve Writer application data: {error}"))
}

fn validate_workspace_request(
    requested: &str,
    state: &Arc<WorkspaceState>,
    action: &str,
) -> Result<String, String> {
    let requested = Path::new(requested)
        .canonicalize()
        .map_err(|error| format!("Could not resolve the requested Workspace: {error}"))?;
    let current = state.workspace_root.read();
    let current = current
        .as_ref()
        .ok_or_else(|| format!("Open a Workspace before {action}."))?;
    if requested != *current {
        return Err(format!(
            "The Workspace changed before {action} could start."
        ));
    }
    Ok(current.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::assistant::{
        add_registration, build_native_fake_agent, create_conversation, fake_agent_artifact_path,
        load_conversation_for_workspace, ReconcileResult, WriterMutationPreparation,
    };
    use serde::de::DeserializeOwned;
    use serde_json::{json, Value};
    use std::fs;
    use std::sync::mpsc;
    use tauri::test::MockRuntime;
    use tauri::Listener;

    struct TestConsentPath(PathBuf);

    struct TestAssistantPaths {
        consent: PathBuf,
        registrations: PathBuf,
        app_data: PathBuf,
    }

    #[tauri::command(rename = "get_ai_access_consent")]
    fn test_get_ai_access_consent(
        workspace_root: String,
        window: tauri::WebviewWindow<MockRuntime>,
        path: tauri::State<'_, TestConsentPath>,
        state: tauri::State<'_, AppState>,
    ) -> Result<ConsentStatus, String> {
        get_ai_access_consent_core(workspace_root, window.label(), path.0.clone(), &state)
    }

    #[tauri::command(rename = "grant_ai_access_consent")]
    fn test_grant_ai_access_consent(
        workspace_root: String,
        window: tauri::WebviewWindow<MockRuntime>,
        path: tauri::State<'_, TestConsentPath>,
        state: tauri::State<'_, AppState>,
    ) -> Result<ConsentStatus, String> {
        grant_ai_access_consent_core(workspace_root, window.label(), path.0.clone(), &state)
    }

    #[tauri::command(rename = "register_agent_turn_bridge")]
    fn test_register_agent_turn_bridge(
        workspace_root: String,
        frontend_generation: u64,
        window: tauri::WebviewWindow<MockRuntime>,
        state: tauri::State<'_, AppState>,
    ) -> Result<TurnBridgeRegistration, String> {
        register_agent_turn_bridge_core(
            workspace_root,
            frontend_generation,
            None,
            window.label(),
            &state,
        )
    }

    #[tauri::command(rename = "unregister_agent_turn_bridge")]
    fn test_unregister_agent_turn_bridge(
        workspace_root: String,
        bridge_id: String,
        window: tauri::WebviewWindow<MockRuntime>,
        state: tauri::State<'_, AppState>,
    ) -> bool {
        unregister_agent_turn_bridge_core(&workspace_root, &bridge_id, window.label(), &state)
    }

    #[tauri::command(rename = "write_file")]
    async fn test_write_file(
        path: String,
        content: String,
        preparation: Option<WriterMutationPreparation>,
        window: tauri::WebviewWindow<MockRuntime>,
        app: tauri::AppHandle<MockRuntime>,
    ) -> Result<crate::commands::fs::WriteResult, crate::error::AppError> {
        crate::commands::fs::write_file_core(path, content, preparation, window.label(), app).await
    }

    #[tauri::command(rename = "start_agent_turn")]
    fn test_start_agent_turn(
        workspace_root: String,
        agent_id: String,
        registration_revision: u64,
        conversation_id: String,
        prompt: String,
        window: tauri::WebviewWindow<MockRuntime>,
        app: tauri::AppHandle<MockRuntime>,
        paths: tauri::State<'_, TestAssistantPaths>,
        state: tauri::State<'_, AppState>,
    ) -> Result<StartAgentTurnResponse, String> {
        start_agent_turn_core(
            workspace_root,
            agent_id,
            registration_revision,
            conversation_id,
            prompt,
            window.label(),
            app,
            paths.consent.clone(),
            paths.registrations.clone(),
            paths.app_data.clone(),
            &state,
            Duration::from_secs(2),
        )
    }

    #[tauri::command(rename = "acknowledge_agent_turn_prepared")]
    fn test_acknowledge_agent_turn_prepared(
        acknowledgement: PrepareAcknowledgement,
        window: tauri::WebviewWindow<MockRuntime>,
        state: tauri::State<'_, AppState>,
    ) -> Result<PrepareResultWire, String> {
        acknowledge_agent_turn_prepared_core(window.label(), acknowledgement, &state)
    }

    #[tauri::command(rename = "acknowledge_agent_turn_reconciled")]
    fn test_acknowledge_agent_turn_reconciled(
        acknowledgement: ReconcileAcknowledgement,
        window: tauri::WebviewWindow<MockRuntime>,
        state: tauri::State<'_, AppState>,
    ) -> Result<bool, String> {
        acknowledge_agent_turn_reconciled_core(window.label(), acknowledgement, &state)
    }

    #[tauri::command(rename = "respond_agent_turn_permission")]
    fn test_respond_agent_turn_permission(
        workspace_root: String,
        turn_id: String,
        request_id: String,
        option_id: Option<String>,
        window: tauri::WebviewWindow<MockRuntime>,
        state: tauri::State<'_, AppState>,
    ) -> Result<(), String> {
        respond_agent_turn_permission_core(
            workspace_root,
            turn_id,
            request_id,
            option_id,
            window.label(),
            &state,
        )
    }

    fn invoke<T: DeserializeOwned>(
        webview: &tauri::WebviewWindow<MockRuntime>,
        command: &str,
        body: Value,
    ) -> Result<T, Value> {
        tauri::test::get_ipc_response(
            webview,
            tauri::webview::InvokeRequest {
                cmd: command.into(),
                callback: tauri::ipc::CallbackFn(0),
                error: tauri::ipc::CallbackFn(1),
                url: "tauri://localhost".parse().unwrap(),
                body: tauri::ipc::InvokeBody::Json(body),
                headers: Default::default(),
                invoke_key: tauri::test::INVOKE_KEY.to_string(),
            },
        )
        .map(|response| response.deserialize::<T>().unwrap())
    }

    #[test]
    fn desktop_consent_is_persisted_per_canonical_workspace_and_rejects_spoofing() {
        let dir = tempfile::tempdir().unwrap();
        let workspace_a = dir.path().join("workspace-a");
        let workspace_b = dir.path().join("workspace-b");
        fs::create_dir_all(&workspace_a).unwrap();
        fs::create_dir_all(&workspace_b).unwrap();
        let consent_path = dir.path().join("assistant-consents.json");
        let app = tauri::test::mock_builder()
            .manage(AppState::new())
            .manage(TestConsentPath(consent_path.clone()))
            .invoke_handler(tauri::generate_handler![
                test_get_ai_access_consent,
                test_grant_ai_access_consent
            ])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let webview = tauri::WebviewWindowBuilder::new(&app, "consent-test", Default::default())
            .build()
            .unwrap();
        let window_state = app.state::<AppState>().get_or_create("consent-test");
        *window_state.workspace_root.write() = Some(workspace_a.canonicalize().unwrap());

        let before = invoke::<ConsentStatus>(
            &webview,
            "get_ai_access_consent",
            json!({ "workspaceRoot": workspace_a }),
        )
        .unwrap();
        assert!(!before.granted);

        let granted = invoke::<ConsentStatus>(
            &webview,
            "grant_ai_access_consent",
            json!({ "workspaceRoot": workspace_a.join(".") }),
        )
        .unwrap();
        assert!(granted.granted);
        assert_eq!(granted.revision, 1);

        let repeated = invoke::<ConsentStatus>(
            &webview,
            "grant_ai_access_consent",
            json!({ "workspaceRoot": workspace_a }),
        )
        .unwrap();
        assert_eq!(repeated.revision, 1, "granting twice must be idempotent");

        let persisted = load_consents(&consent_path).unwrap();
        assert_eq!(persisted.revision, 1);
        assert_eq!(persisted.workspaces, vec![granted.workspace_root.clone()]);

        *window_state.workspace_root.write() = Some(workspace_b.canonicalize().unwrap());
        let separate = invoke::<ConsentStatus>(
            &webview,
            "get_ai_access_consent",
            json!({ "workspaceRoot": workspace_b }),
        )
        .unwrap();
        assert!(!separate.granted);

        let spoofed = invoke::<ConsentStatus>(
            &webview,
            "get_ai_access_consent",
            json!({ "workspaceRoot": workspace_a }),
        );
        assert!(spoofed.is_err());
    }

    #[test]
    fn shared_turn_wire_fixture_round_trips_rust_serde_models() {
        let raw: Value =
            serde_json::from_str(include_str!("../../../shared/assistant-turn-wire.json")).unwrap();
        let bridge: TurnBridgeRegistration =
            serde_json::from_value(raw["bridgeRegistration"].clone()).unwrap();
        assert_eq!(
            serde_json::to_value(bridge).unwrap(),
            raw["bridgeRegistration"]
        );
        for raw_event in raw["events"].as_array().unwrap() {
            let event: AgentTurnEvent = serde_json::from_value(raw_event.clone()).unwrap();
            assert_eq!(serde_json::to_value(event).unwrap(), *raw_event);
        }
    }

    #[test]
    fn desktop_write_boundary_requires_exact_prepare_identity_during_agent_turn() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir_all(&workspace).unwrap();
        let workspace = workspace.canonicalize().unwrap();
        let note = workspace.join("note.md");
        let stale_note = dir.path().join("previous-workspace-note.md");
        fs::write(&note, "before").unwrap();
        fs::write(&stale_note, "stale-before").unwrap();
        let app = tauri::test::mock_builder()
            .manage(AppState::new())
            .invoke_handler(tauri::generate_handler![test_write_file])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let webview = tauri::WebviewWindowBuilder::new(&app, "writer", Default::default())
            .build()
            .unwrap();
        let app_state = app.state::<AppState>();
        let window_state = app_state.get_or_create("writer");
        *window_state.workspace_root.write() = Some(workspace.clone());
        window_state.workspace_epoch.store(3, Ordering::Release);
        let stale = invoke::<Value>(
            &webview,
            "write_file",
            json!({ "path": stale_note, "content": "stale-after", "preparation": null }),
        );
        assert!(stale.is_err());
        assert_eq!(fs::read_to_string(&stale_note).unwrap(), "stale-before");
        app_state
            .agent_coordinator
            .register_bridge("writer", workspace.clone(), 3, 5)
            .unwrap();
        let turn = app_state
            .agent_coordinator
            .reserve(workspace.clone(), &[("writer".into(), 3)])
            .unwrap();
        let request = turn.prepare_requests().pop().unwrap();

        let denied = invoke::<Value>(
            &webview,
            "write_file",
            json!({ "path": note, "content": "denied", "preparation": null }),
        );
        assert!(denied.is_err());
        assert_eq!(fs::read_to_string(&note).unwrap(), "before");

        let preparation = WriterMutationPreparation {
            turn_id: request.turn_id,
            workspace_root: request.workspace_root,
            workspace_epoch: request.workspace_epoch,
            participant_token: request.participant_token,
            bridge_id: request.bridge_id,
            request_id: request.request_id,
        };
        invoke::<Value>(
            &webview,
            "write_file",
            json!({ "path": note, "content": "prepared", "preparation": preparation }),
        )
        .unwrap();
        assert_eq!(fs::read_to_string(note).unwrap(), "prepared");
    }

    #[test]
    fn desktop_partial_prepare_failure_reconciles_before_unlock_without_runtime_start() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir_all(&workspace).unwrap();
        let workspace = workspace.canonicalize().unwrap();
        let consent_path = dir.path().join("assistant-consents.json");
        grant_consent(&consent_path, workspace.to_string_lossy().into_owned()).unwrap();
        let app_data = dir.path().join("app-data");
        fs::create_dir_all(&app_data).unwrap();
        let conversation = create_conversation(
            &app_data,
            workspace.to_string_lossy().into_owned(),
            "codex-acp".into(),
            Some("Prepare fail".into()),
        )
        .unwrap();
        let app = tauri::test::mock_builder()
            .manage(AppState::new())
            .manage(TestAssistantPaths {
                consent: consent_path,
                registrations: dir.path().join("assistant-agents.json"),
                app_data,
            })
            .invoke_handler(tauri::generate_handler![
                test_register_agent_turn_bridge,
                test_start_agent_turn,
                test_acknowledge_agent_turn_prepared,
                test_acknowledge_agent_turn_reconciled
            ])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let first = tauri::WebviewWindowBuilder::new(&app, "first", Default::default())
            .build()
            .unwrap();
        let second = tauri::WebviewWindowBuilder::new(&app, "second", Default::default())
            .build()
            .unwrap();
        let app_state = app.state::<AppState>();
        for (label, epoch) in [("first", 4), ("second", 7)] {
            let state = app_state.get_or_create(label);
            *state.workspace_root.write() = Some(workspace.clone());
            state.workspace_epoch.store(epoch, Ordering::Release);
        }
        let workspace_root = workspace.to_string_lossy().into_owned();
        invoke::<TurnBridgeRegistration>(
            &first,
            "register_agent_turn_bridge",
            json!({ "workspaceRoot": workspace_root, "frontendGeneration": 10 }),
        )
        .unwrap();
        invoke::<TurnBridgeRegistration>(
            &second,
            "register_agent_turn_bridge",
            json!({ "workspaceRoot": workspace_root, "frontendGeneration": 20 }),
        )
        .unwrap();

        let (event_tx, event_rx) = mpsc::channel();
        for (label, webview) in [("first", &first), ("second", &second)] {
            let event_tx = event_tx.clone();
            webview.listen("assistant:turn-event", move |event| {
                let event = serde_json::from_str::<AgentTurnEvent>(event.payload()).unwrap();
                let _ = event_tx.send((label, event));
            });
        }
        let started = invoke::<StartAgentTurnResponse>(
            &first,
            "start_agent_turn",
            json!({
                "workspaceRoot": workspace_root,
                "agentId": "codex-acp",
                "registrationRevision": 0,
                "conversationId": conversation.id,
                "prompt": "Update the Workspace"
            }),
        )
        .unwrap();

        let mut prepare = Vec::new();
        while prepare.len() < 2 {
            let (_, event) = event_rx.recv_timeout(Duration::from_secs(2)).unwrap();
            if matches!(event, AgentTurnEvent::Prepare { .. }) {
                prepare.push(event);
            }
        }
        prepare.sort_by_key(|event| match event {
            AgentTurnEvent::Prepare {
                workspace_epoch, ..
            } => *workspace_epoch,
            _ => unreachable!(),
        });
        let make_prepare_ack = |event: &AgentTurnEvent, lease, error| match event {
            AgentTurnEvent::Prepare {
                turn_id,
                workspace_root,
                workspace_epoch,
                participant_token,
                bridge_id,
                request_id,
                ..
            } => PrepareAcknowledgement {
                turn_id: turn_id.clone(),
                workspace_root: workspace_root.clone(),
                workspace_epoch: *workspace_epoch,
                participant_token: participant_token.clone(),
                bridge_id: bridge_id.clone(),
                request_id: request_id.clone(),
                lease,
                error,
            },
            _ => unreachable!(),
        };
        let lease = FrontendLeaseIdentity {
            generation: 10,
            id: 91,
        };
        invoke::<PrepareResultWire>(
            &first,
            "acknowledge_agent_turn_prepared",
            json!({
                "acknowledgement": make_prepare_ack(&prepare[0], Some(lease.clone()), None)
            }),
        )
        .unwrap();
        invoke::<PrepareResultWire>(
            &second,
            "acknowledge_agent_turn_prepared",
            json!({
                "acknowledgement": make_prepare_ack(&prepare[1], None, Some("save failed".into()))
            }),
        )
        .unwrap();

        let reconcile = loop {
            let (_, event) = event_rx.recv_timeout(Duration::from_secs(2)).unwrap();
            if let AgentTurnEvent::Reconcile { .. } = event {
                break event;
            }
        };
        let acknowledgement = match reconcile {
            AgentTurnEvent::Reconcile {
                turn_id,
                workspace_root,
                workspace_epoch,
                participant_token,
                bridge_id,
                request_id,
                lease,
                ..
            } => ReconcileAcknowledgement {
                turn_id,
                workspace_root,
                workspace_epoch,
                participant_token,
                bridge_id,
                request_id,
                lease,
                result: ReconcileResult::Completed,
            },
            _ => unreachable!(),
        };
        assert!(invoke::<bool>(
            &first,
            "acknowledge_agent_turn_reconciled",
            json!({ "acknowledgement": acknowledgement }),
        )
        .unwrap());
        assert!(app_state.agent_coordinator.is_active(&workspace));

        let terminal = loop {
            let (_, event) = event_rx.recv_timeout(Duration::from_secs(2)).unwrap();
            if let AgentTurnEvent::Terminal { .. } = event {
                break event;
            }
        };
        assert!(matches!(
            terminal,
            AgentTurnEvent::Terminal { ref status, ref message, .. }
                if status == "failed" && message.contains("save failed")
        ));
        let inactive = (0..20).any(|_| {
            if !app_state.agent_coordinator.is_active(&workspace) {
                true
            } else {
                std::thread::sleep(Duration::from_millis(5));
                false
            }
        });
        assert!(
            inactive,
            "terminal publication must be followed by driver cleanup"
        );
        assert_eq!(
            started.turn_id,
            match prepare[0].clone() {
                AgentTurnEvent::Prepare { turn_id, .. } => turn_id,
                _ => unreachable!(),
            }
        );
    }

    #[cfg(unix)]
    #[test]
    fn desktop_fake_agent_turn_orders_consent_prepare_stream_reconcile_and_unlock() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir_all(&workspace).unwrap();
        let workspace = workspace.canonicalize().unwrap();
        let source = build_native_fake_agent(dir.path(), "turn_permission");
        let pid_path = fake_agent_artifact_path(&source, "pids");
        let registration_path = dir.path().join("assistant-agents.json");
        let registrations = add_registration(
            &registration_path,
            source.to_string_lossy().into_owned(),
            vec!["--stdio".into()],
        )
        .unwrap();
        let registration = registrations.registrations[0].clone();
        let consent_path = dir.path().join("assistant-consents.json");
        let app_data = dir.path().join("app-data");
        fs::create_dir_all(&app_data).unwrap();
        let conversation = create_conversation(
            &app_data,
            workspace.to_string_lossy().into_owned(),
            registration.id.clone(),
            Some("Native fixture".into()),
        )
        .unwrap();
        let app = tauri::test::mock_builder()
            .manage(AppState::new())
            .manage(TestConsentPath(consent_path.clone()))
            .manage(TestAssistantPaths {
                consent: consent_path,
                registrations: registration_path,
                app_data: app_data.clone(),
            })
            .invoke_handler(tauri::generate_handler![
                test_grant_ai_access_consent,
                test_register_agent_turn_bridge,
                test_unregister_agent_turn_bridge,
                test_start_agent_turn,
                test_acknowledge_agent_turn_prepared,
                test_acknowledge_agent_turn_reconciled,
                test_respond_agent_turn_permission
            ])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let webview = tauri::WebviewWindowBuilder::new(&app, "turn", Default::default())
            .build()
            .unwrap();
        let app_state = app.state::<AppState>();
        let window_state = app_state.get_or_create("turn");
        *window_state.workspace_root.write() = Some(workspace.clone());
        window_state.workspace_epoch.store(8, Ordering::Release);
        let workspace_root = workspace.to_string_lossy().into_owned();

        let consent = invoke::<ConsentStatus>(
            &webview,
            "grant_ai_access_consent",
            json!({ "workspaceRoot": workspace_root }),
        )
        .unwrap();
        assert!(consent.granted);
        let bridge = invoke::<TurnBridgeRegistration>(
            &webview,
            "register_agent_turn_bridge",
            json!({ "workspaceRoot": workspace_root, "frontendGeneration": 31 }),
        )
        .unwrap();

        let (event_tx, event_rx) = mpsc::channel();
        webview.listen("assistant:turn-event", move |event| {
            let event = serde_json::from_str::<AgentTurnEvent>(event.payload()).unwrap();
            let _ = event_tx.send(event);
        });
        let started = invoke::<StartAgentTurnResponse>(
            &webview,
            "start_agent_turn",
            json!({
                "workspaceRoot": workspace_root,
                "agentId": registration.id,
                "registrationRevision": registrations.revision,
                "conversationId": conversation.id,
                "prompt": "Update the Workspace"
            }),
        )
        .unwrap();

        let prepare = event_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        let acknowledgement = match prepare {
            AgentTurnEvent::Prepare {
                turn_id,
                workspace_root,
                workspace_epoch,
                participant_token,
                bridge_id,
                request_id,
                ..
            } => PrepareAcknowledgement {
                turn_id,
                workspace_root,
                workspace_epoch,
                participant_token,
                bridge_id,
                request_id,
                lease: Some(FrontendLeaseIdentity {
                    generation: 31,
                    id: 44,
                }),
                error: None,
            },
            event => panic!("expected prepare event, got {event:?}"),
        };
        assert_eq!(
            invoke::<PrepareResultWire>(
                &webview,
                "acknowledge_agent_turn_prepared",
                json!({ "acknowledgement": acknowledgement }),
            )
            .unwrap(),
            PrepareResultWire::Ready
        );

        let mut order = vec!["consent", "prepare"];
        let mut streamed = String::new();
        let mut summaries = Vec::new();
        let mut running_phases = 0;
        loop {
            let event = event_rx.recv_timeout(Duration::from_secs(8)).unwrap();
            match event {
                AgentTurnEvent::Phase {
                    phase: TurnPhase::Running,
                    ..
                } => {
                    running_phases += 1;
                    if running_phases == 1 {
                        order.push("run");
                    }
                }
                AgentTurnEvent::StreamText { text, .. } => {
                    order.push("stream");
                    streamed.push_str(&text);
                }
                AgentTurnEvent::ChangeSummary { summary, .. } => summaries.push(summary),
                AgentTurnEvent::Permission {
                    turn_id,
                    workspace_root,
                    request_id,
                    title,
                    options,
                    ..
                } => {
                    assert_eq!(title, "Access the network");
                    assert!(options.iter().any(|option| option.id == "reject-once"));
                    invoke::<()>(
                        &webview,
                        "respond_agent_turn_permission",
                        json!({
                            "workspaceRoot": workspace_root,
                            "turnId": turn_id,
                            "requestId": request_id,
                            "optionId": "allow-once",
                        }),
                    )
                    .unwrap();
                }
                AgentTurnEvent::Phase {
                    phase: TurnPhase::Reconciling,
                    ..
                } => {
                    order.push("reconcile");
                }
                AgentTurnEvent::Reconcile {
                    turn_id,
                    workspace_root,
                    workspace_epoch,
                    participant_token,
                    bridge_id,
                    request_id,
                    lease,
                    ..
                } => {
                    assert_eq!(
                        fs::read_to_string(workspace.join("agent-change.md")).unwrap(),
                        "# Written by fake Agent\n"
                    );
                    assert!(invoke::<bool>(
                        &webview,
                        "acknowledge_agent_turn_reconciled",
                        json!({
                            "acknowledgement": ReconcileAcknowledgement {
                                turn_id,
                                workspace_root,
                                workspace_epoch,
                                participant_token,
                                bridge_id,
                                request_id,
                                lease,
                                result: ReconcileResult::Completed,
                            }
                        }),
                    )
                    .unwrap());
                }
                AgentTurnEvent::Terminal {
                    status, message, ..
                } => {
                    assert_eq!(status, "completed", "unexpected terminal: {message}");
                    order.push("unlock");
                    break;
                }
                _ => {}
            }
        }
        assert_eq!(streamed, "Turn complete");
        assert_eq!(summaries, vec!["Updated agent-change.md"]);
        assert_eq!(
            running_phases, 2,
            "permission resolution must resume every window"
        );
        assert_eq!(
            order,
            vec!["consent", "prepare", "run", "stream", "reconcile", "unlock"]
        );
        assert!((0..20).any(|_| {
            if !app_state.agent_coordinator.is_active(&workspace) {
                true
            } else {
                std::thread::sleep(Duration::from_millis(5));
                false
            }
        }));
        assert_eq!(started.conversation_id, conversation.id);
        let persisted =
            load_conversation_for_workspace(&app_data, &workspace_root, &conversation.id).unwrap();
        assert_eq!(persisted.messages.len(), 2);
        assert_eq!(persisted.messages[0].content, "Update the Workspace");
        assert_eq!(persisted.messages[1].content, "Turn complete");
        assert_eq!(
            persisted.runtime_session_id.as_deref(),
            Some("fake-session")
        );
        assert_eq!(persisted.turns.len(), 1);
        assert!(!serde_json::to_string(&persisted)
            .unwrap()
            .contains("thought"));
        assert!(invoke::<bool>(
            &webview,
            "unregister_agent_turn_bridge",
            json!({ "workspaceRoot": workspace_root, "bridgeId": bridge.bridge_id }),
        )
        .unwrap());
        for pid in fs::read_to_string(pid_path).unwrap().lines() {
            assert!(!std::process::Command::new("/bin/kill")
                .args(["-0", pid])
                .status()
                .unwrap()
                .success());
        }
    }

    #[cfg(unix)]
    #[test]
    fn desktop_agent_crash_reconciles_partial_write_before_failed_unlock() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir_all(&workspace).unwrap();
        let workspace = workspace.canonicalize().unwrap();
        let source = build_native_fake_agent(dir.path(), "turn_write_fail");
        let registration_path = dir.path().join("assistant-agents.json");
        let registrations = add_registration(
            &registration_path,
            source.to_string_lossy().into_owned(),
            vec![],
        )
        .unwrap();
        let consent_path = dir.path().join("assistant-consents.json");
        grant_consent(&consent_path, workspace.to_string_lossy().into_owned()).unwrap();
        let app_data = dir.path().join("app-data");
        fs::create_dir_all(&app_data).unwrap();
        let conversation = create_conversation(
            &app_data,
            workspace.to_string_lossy().into_owned(),
            registrations.registrations[0].id.clone(),
            Some("Crash fixture".into()),
        )
        .unwrap();
        let app = tauri::test::mock_builder()
            .manage(AppState::new())
            .manage(TestAssistantPaths {
                consent: consent_path,
                registrations: registration_path,
                app_data,
            })
            .invoke_handler(tauri::generate_handler![
                test_register_agent_turn_bridge,
                test_start_agent_turn,
                test_acknowledge_agent_turn_prepared,
                test_acknowledge_agent_turn_reconciled
            ])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let webview = tauri::WebviewWindowBuilder::new(&app, "crash", Default::default())
            .build()
            .unwrap();
        let app_state = app.state::<AppState>();
        let window_state = app_state.get_or_create("crash");
        *window_state.workspace_root.write() = Some(workspace.clone());
        window_state.workspace_epoch.store(2, Ordering::Release);
        let workspace_root = workspace.to_string_lossy().into_owned();
        invoke::<TurnBridgeRegistration>(
            &webview,
            "register_agent_turn_bridge",
            json!({ "workspaceRoot": workspace_root, "frontendGeneration": 6 }),
        )
        .unwrap();
        let (event_tx, event_rx) = mpsc::channel();
        webview.listen("assistant:turn-event", move |event| {
            let event = serde_json::from_str::<AgentTurnEvent>(event.payload()).unwrap();
            let _ = event_tx.send(event);
        });
        invoke::<StartAgentTurnResponse>(
            &webview,
            "start_agent_turn",
            json!({
                "workspaceRoot": workspace_root,
                "agentId": registrations.registrations[0].id,
                "registrationRevision": registrations.revision,
                "conversationId": conversation.id,
                "prompt": "Write then fail"
            }),
        )
        .unwrap();
        let prepare = event_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        let acknowledgement = match prepare {
            AgentTurnEvent::Prepare {
                turn_id,
                workspace_root,
                workspace_epoch,
                participant_token,
                bridge_id,
                request_id,
                ..
            } => PrepareAcknowledgement {
                turn_id,
                workspace_root,
                workspace_epoch,
                participant_token,
                bridge_id,
                request_id,
                lease: Some(FrontendLeaseIdentity {
                    generation: 6,
                    id: 7,
                }),
                error: None,
            },
            other => panic!("expected prepare, got {other:?}"),
        };
        invoke::<PrepareResultWire>(
            &webview,
            "acknowledge_agent_turn_prepared",
            json!({ "acknowledgement": acknowledgement }),
        )
        .unwrap();

        loop {
            let event = event_rx.recv_timeout(Duration::from_secs(8)).unwrap();
            if let AgentTurnEvent::Reconcile {
                turn_id,
                workspace_root,
                workspace_epoch,
                participant_token,
                bridge_id,
                request_id,
                lease,
                ..
            } = event
            {
                assert_eq!(
                    fs::read_to_string(workspace.join("agent-change.md")).unwrap(),
                    "# Written by fake Agent\n"
                );
                invoke::<bool>(
                    &webview,
                    "acknowledge_agent_turn_reconciled",
                    json!({
                        "acknowledgement": ReconcileAcknowledgement {
                            turn_id,
                            workspace_root,
                            workspace_epoch,
                            participant_token,
                            bridge_id,
                            request_id,
                            lease,
                            result: ReconcileResult::Completed,
                        }
                    }),
                )
                .unwrap();
                break;
            }
        }
        let terminal = loop {
            let event = event_rx.recv_timeout(Duration::from_secs(2)).unwrap();
            if let AgentTurnEvent::Terminal { .. } = event {
                break event;
            }
        };
        assert!(matches!(
            terminal,
            AgentTurnEvent::Terminal { status, message, .. }
                if status == "failed"
                    && message.contains("partial changes remain")
                    && message.contains("does not roll them back")
        ));
        assert!((0..20).any(|_| {
            if !app_state.agent_coordinator.is_active(&workspace) {
                true
            } else {
                std::thread::sleep(Duration::from_millis(5));
                false
            }
        }));
    }
}

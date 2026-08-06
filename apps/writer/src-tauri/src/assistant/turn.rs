use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{oneshot, watch, Notify};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TurnPhase {
    Preparing,
    Running,
    AwaitingPermission,
    Reconciling,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendLeaseIdentity {
    pub generation: u64,
    pub id: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareAcknowledgement {
    pub turn_id: String,
    pub workspace_root: String,
    pub workspace_epoch: u64,
    pub participant_token: String,
    pub bridge_id: String,
    pub request_id: String,
    pub lease: Option<FrontendLeaseIdentity>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconcileAcknowledgement {
    pub turn_id: String,
    pub workspace_root: String,
    pub workspace_epoch: u64,
    pub participant_token: String,
    pub bridge_id: String,
    pub request_id: String,
    pub lease: FrontendLeaseIdentity,
    pub result: ReconcileResult,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriterMutationPreparation {
    pub turn_id: String,
    pub workspace_root: String,
    pub workspace_epoch: u64,
    pub participant_token: String,
    pub bridge_id: String,
    pub request_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ReconcileResult {
    Completed,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PrepareResult {
    Ready,
    Failed(String),
    Pending,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LifecycleRequest {
    pub turn_id: String,
    pub workspace_root: String,
    pub workspace_epoch: u64,
    pub participant_token: String,
    pub bridge_id: String,
    pub request_id: String,
    pub lease: Option<FrontendLeaseIdentity>,
    pub window_label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnPermissionOption {
    pub id: String,
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TurnPermissionRequest {
    pub request_id: String,
    pub title: String,
    pub options: Vec<TurnPermissionOption>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordedPermissionDecision {
    pub request_id: String,
    pub title: String,
    pub option_id: Option<String>,
}

#[derive(Clone)]
pub struct TurnReservation {
    inner: Arc<ActiveTurn>,
}

impl TurnReservation {
    pub fn turn_id(&self) -> &str {
        &self.inner.turn_id
    }

    pub fn workspace_root(&self) -> &Path {
        &self.inner.workspace_root
    }

    pub fn cancellation_receiver(&self) -> watch::Receiver<bool> {
        self.inner.cancellation_tx.subscribe()
    }

    #[cfg(test)]
    pub fn phase(&self) -> TurnPhase {
        self.inner.state.lock().phase
    }

    pub fn prepare_requests(&self) -> Vec<LifecycleRequest> {
        let state = self.inner.state.lock();
        let mut requests = state
            .participants
            .iter()
            .map(|(window_label, participant)| LifecycleRequest {
                turn_id: self.inner.turn_id.clone(),
                workspace_root: self.inner.workspace_root.to_string_lossy().into_owned(),
                workspace_epoch: participant.workspace_epoch,
                participant_token: participant.participant_token.clone(),
                bridge_id: participant.bridge_id.clone(),
                request_id: participant.prepare_request_id.clone(),
                lease: None,
                window_label: window_label.clone(),
            })
            .collect::<Vec<_>>();
        requests.sort_by(|left, right| left.window_label.cmp(&right.window_label));
        requests
    }

    pub fn acknowledge_prepare(
        &self,
        window_label: &str,
        acknowledgement: PrepareAcknowledgement,
    ) -> Result<PrepareResult, String> {
        let mut state = self.inner.state.lock();
        if state.phase != TurnPhase::Preparing {
            return Err("The Agent Turn is not accepting prepare acknowledgements.".into());
        }
        let participant = state
            .participants
            .get_mut(window_label)
            .ok_or_else(|| "The invoking window is not an Agent Turn participant.".to_string())?;
        validate_common_acknowledgement(
            &self.inner,
            participant,
            &acknowledgement.turn_id,
            &acknowledgement.workspace_root,
            acknowledgement.workspace_epoch,
            &acknowledgement.participant_token,
            &acknowledgement.bridge_id,
        )?;
        if acknowledgement.request_id != participant.prepare_request_id {
            return Err("The prepare acknowledgement request is stale or unsolicited.".into());
        }
        if !matches!(participant.prepare, ParticipantPrepare::Pending) {
            return Err("The prepare request was already acknowledged.".into());
        }
        participant.prepare = match (acknowledgement.lease, acknowledgement.error) {
            (Some(lease), None) => {
                if lease.generation != participant.frontend_generation {
                    return Err(
                        "The prepare lease belongs to a different Workspace generation.".into(),
                    );
                }
                ParticipantPrepare::Prepared(lease)
            }
            (None, Some(error)) if !error.trim().is_empty() => ParticipantPrepare::Failed(error),
            _ => {
                return Err(
                    "A prepare acknowledgement must contain either one lease or one error.".into(),
                );
            }
        };
        let result = preparation_result(&state.participants);
        drop(state);
        self.inner.changed.notify_waiters();
        Ok(result)
    }

    pub fn preparation_result(&self) -> PrepareResult {
        preparation_result(&self.inner.state.lock().participants)
    }

    pub fn begin_reconciliation(&self) -> Vec<LifecycleRequest> {
        let mut state = self.inner.state.lock();
        assert!(
            matches!(
                state.phase,
                TurnPhase::Preparing | TurnPhase::Running | TurnPhase::AwaitingPermission
            ),
            "reconciliation begins only after prepare/runtime"
        );
        state.phase = TurnPhase::Reconciling;
        let mut requests = Vec::new();
        for (window_label, participant) in &mut state.participants {
            let ParticipantPrepare::Prepared(lease) = &participant.prepare else {
                continue;
            };
            let request_id = uuid::Uuid::new_v4().to_string();
            participant.reconcile_request_id = Some(request_id.clone());
            participant.reconcile = None;
            requests.push(LifecycleRequest {
                turn_id: self.inner.turn_id.clone(),
                workspace_root: self.inner.workspace_root.to_string_lossy().into_owned(),
                workspace_epoch: participant.workspace_epoch,
                participant_token: participant.participant_token.clone(),
                bridge_id: participant.bridge_id.clone(),
                request_id,
                lease: Some(lease.clone()),
                window_label: window_label.clone(),
            });
        }
        requests.sort_by(|left, right| left.window_label.cmp(&right.window_label));
        requests
    }

    pub fn acknowledge_reconcile(
        &self,
        window_label: &str,
        acknowledgement: ReconcileAcknowledgement,
    ) -> Result<bool, String> {
        let mut state = self.inner.state.lock();
        if state.phase != TurnPhase::Reconciling {
            return Err("The Agent Turn is not accepting reconciliation acknowledgements.".into());
        }
        let participant = state
            .participants
            .get_mut(window_label)
            .ok_or_else(|| "The invoking window is not an Agent Turn participant.".to_string())?;
        validate_common_acknowledgement(
            &self.inner,
            participant,
            &acknowledgement.turn_id,
            &acknowledgement.workspace_root,
            acknowledgement.workspace_epoch,
            &acknowledgement.participant_token,
            &acknowledgement.bridge_id,
        )?;
        if participant.reconcile_request_id.as_deref() != Some(&acknowledgement.request_id) {
            return Err(
                "The reconciliation acknowledgement request is stale or unsolicited.".into(),
            );
        }
        let ParticipantPrepare::Prepared(lease) = &participant.prepare else {
            return Err("That participant did not acquire a Workspace lease.".into());
        };
        if lease != &acknowledgement.lease {
            return Err(
                "The reconciliation acknowledgement has a different lease identity.".into(),
            );
        }
        if participant.reconcile.is_some() {
            return Err("The reconciliation request was already acknowledged.".into());
        }
        participant.reconcile = Some(acknowledgement.result);
        let complete = reconciliation_complete(&state.participants);
        drop(state);
        self.inner.changed.notify_waiters();
        Ok(complete)
    }

    pub fn reconciliation_complete(&self) -> bool {
        reconciliation_complete(&self.inner.state.lock().participants)
    }

    pub fn reconciliation_failed(&self) -> bool {
        self.inner
            .state
            .lock()
            .participants
            .values()
            .any(|participant| participant.reconcile == Some(ReconcileResult::Failed))
    }

    pub async fn wait_for_preparation(&self, deadline: Duration) -> Result<PrepareResult, String> {
        tokio::time::timeout(deadline, async {
            loop {
                let notified = self.inner.changed.notified();
                let result = self.preparation_result();
                if result != PrepareResult::Pending {
                    return result;
                }
                notified.await;
            }
        })
        .await
        .map_err(|_| {
            format!(
                "Workspace preparation timed out after {} ms.",
                deadline.as_millis()
            )
        })
    }

    pub async fn wait_for_reconciliation(&self, deadline: Duration) -> Result<(), String> {
        tokio::time::timeout(deadline, async {
            loop {
                let notified = self.inner.changed.notified();
                if self.reconciliation_failed() {
                    return Err(
                        "Writer could not reload every changed Workspace item during reconciliation."
                            .to_string(),
                    );
                }
                if self.reconciliation_complete() {
                    return Ok(());
                }
                notified.await;
            }
        })
        .await
        .map_err(|_| {
            format!(
                "Workspace reconciliation timed out after {} ms.",
                deadline.as_millis()
            )
        })?
    }

    pub async fn wait_for_reconciliation_release(&self, deadline: Duration) -> Result<(), String> {
        tokio::time::timeout(deadline, async {
            loop {
                let notified = self.inner.changed.notified();
                if self.reconciliation_complete() {
                    return;
                }
                notified.await;
            }
        })
        .await
        .map_err(|_| {
            format!(
                "Workspace reconciliation remains blocked after {} ms.",
                deadline.as_millis()
            )
        })
    }

    pub fn mark_running(&self) -> Result<(), String> {
        if self.preparation_result() != PrepareResult::Ready {
            return Err("The Agent Turn cannot run before every Workspace prepares.".into());
        }
        let mut state = self.inner.state.lock();
        if state.phase != TurnPhase::Preparing {
            return Err("The Agent Turn is no longer preparing.".into());
        }
        state.phase = TurnPhase::Running;
        Ok(())
    }

    pub fn begin_permission(
        &self,
        title: String,
        options: Vec<TurnPermissionOption>,
        response: oneshot::Sender<Option<String>>,
    ) -> Result<TurnPermissionRequest, String> {
        if options.is_empty() {
            return Err("The Agent requested permission without any choices.".into());
        }
        let mut state = self.inner.state.lock();
        if state.phase != TurnPhase::Running || state.pending_permission.is_some() {
            return Err("The Agent Turn cannot open another permission request now.".into());
        }
        let request_id = uuid::Uuid::new_v4().to_string();
        state.phase = TurnPhase::AwaitingPermission;
        state.pending_permission = Some(PendingPermission {
            request_id: request_id.clone(),
            title: title.clone(),
            option_ids: options.iter().map(|option| option.id.clone()).collect(),
            response: Some(response),
        });
        Ok(TurnPermissionRequest {
            request_id,
            title,
            options,
        })
    }

    pub fn respond_permission(
        &self,
        window_label: &str,
        request_id: &str,
        option_id: Option<String>,
    ) -> Result<(), String> {
        let mut state = self.inner.state.lock();
        if !state.participants.contains_key(window_label) {
            return Err("The invoking window is not an Agent Turn participant.".into());
        }
        if state.phase != TurnPhase::AwaitingPermission {
            return Err("The Agent Turn is not awaiting a permission decision.".into());
        }
        let pending = state
            .pending_permission
            .as_mut()
            .ok_or_else(|| "The Agent Turn has no pending permission request.".to_string())?;
        if pending.request_id != request_id {
            return Err("The permission request identity is stale.".into());
        }
        if let Some(option_id) = &option_id {
            if !pending.option_ids.contains(option_id) {
                return Err("The selected permission option was not offered by the Agent.".into());
            }
        }
        let response = pending
            .response
            .take()
            .ok_or_else(|| "The permission request was already answered.".to_string())?;
        let title = pending.title.clone();
        state.pending_permission = None;
        state.phase = TurnPhase::Running;
        state.permission_decisions.push(RecordedPermissionDecision {
            request_id: request_id.into(),
            title,
            option_id: option_id.clone(),
        });
        drop(state);
        response
            .send(option_id)
            .map_err(|_| "The Agent stopped before receiving the permission decision.".to_string())
    }

    pub fn cancel_pending_permission(&self) {
        let mut state = self.inner.state.lock();
        if let Some(mut pending) = state.pending_permission.take() {
            if let Some(response) = pending.response.take() {
                let _ = response.send(None);
            }
        }
    }

    pub fn permission_decisions(&self) -> Vec<RecordedPermissionDecision> {
        self.inner.state.lock().permission_decisions.clone()
    }
}

#[derive(Default)]
pub struct AgentCoordinator {
    state: Mutex<CoordinatorState>,
}

#[derive(Default)]
struct CoordinatorState {
    bridges: HashMap<String, Bridge>,
    active: HashMap<PathBuf, Arc<ActiveTurn>>,
    writer_mutations: HashMap<PathBuf, usize>,
    workspace_transitions: HashMap<String, Option<PathBuf>>,
    transition_targets: HashMap<PathBuf, usize>,
}

pub struct WriterMutationPermit {
    coordinator: Arc<AgentCoordinator>,
    workspace_root: PathBuf,
    pub capability: Option<cap_std::fs::Dir>,
}

impl WriterMutationPermit {
    pub(crate) fn attach_capability(mut self, capability: cap_std::fs::Dir) -> Self {
        self.capability = Some(capability);
        self
    }
}

pub struct WorkspaceTransitionPermit {
    coordinator: Arc<AgentCoordinator>,
    window_label: String,
}

impl Drop for WriterMutationPermit {
    fn drop(&mut self) {
        let mut state = self.coordinator.state.lock();
        let Some(count) = state.writer_mutations.get_mut(&self.workspace_root) else {
            return;
        };
        *count -= 1;
        if *count == 0 {
            state.writer_mutations.remove(&self.workspace_root);
        }
    }
}

impl Drop for WorkspaceTransitionPermit {
    fn drop(&mut self) {
        let target = self
            .coordinator
            .state
            .lock()
            .workspace_transitions
            .remove(&self.window_label)
            .flatten();
        if let Some(target) = target {
            let mut state = self.coordinator.state.lock();
            if let Some(count) = state.transition_targets.get_mut(&target) {
                *count -= 1;
                if *count == 0 {
                    state.transition_targets.remove(&target);
                }
            }
        }
    }
}

struct Bridge {
    workspace_root: PathBuf,
    workspace_epoch: u64,
    frontend_generation: u64,
    bridge_id: String,
}

struct ActiveTurn {
    turn_id: String,
    workspace_root: PathBuf,
    state: Mutex<ActiveTurnState>,
    changed: Notify,
    cancellation_tx: watch::Sender<bool>,
}

struct ActiveTurnState {
    phase: TurnPhase,
    participants: HashMap<String, Participant>,
    pending_permission: Option<PendingPermission>,
    permission_decisions: Vec<RecordedPermissionDecision>,
}

struct PendingPermission {
    request_id: String,
    title: String,
    option_ids: Vec<String>,
    response: Option<oneshot::Sender<Option<String>>>,
}

struct Participant {
    workspace_epoch: u64,
    frontend_generation: u64,
    bridge_id: String,
    participant_token: String,
    prepare_request_id: String,
    prepare: ParticipantPrepare,
    reconcile_request_id: Option<String>,
    reconcile: Option<ReconcileResult>,
}

enum ParticipantPrepare {
    Pending,
    Prepared(FrontendLeaseIdentity),
    Failed(String),
}

impl AgentCoordinator {
    pub fn acquire_writer_mutation(
        self: &Arc<Self>,
        window_label: &str,
        workspace_root: &Path,
        preparation: Option<&WriterMutationPreparation>,
    ) -> Result<WriterMutationPermit, String> {
        let mut state = self.state.lock();
        if state.workspace_transitions.contains_key(window_label)
            || state.transition_targets.contains_key(workspace_root)
        {
            return Err("The invoking window is changing Workspace.".into());
        }
        if let Some(turn) = state.active.get(workspace_root) {
            let turn_state = turn.state.lock();
            let participant = turn_state.participants.get(window_label).ok_or_else(|| {
                "The invoking window is not an active Agent Turn participant.".to_string()
            })?;
            let preparation = preparation.ok_or_else(|| {
                "Writer cannot modify this Workspace while an Agent Turn is active.".to_string()
            })?;
            if turn_state.phase != TurnPhase::Preparing
                || preparation.turn_id != turn.turn_id
                || preparation.workspace_root != workspace_root.to_string_lossy()
                || preparation.workspace_epoch != participant.workspace_epoch
                || preparation.participant_token != participant.participant_token
                || preparation.bridge_id != participant.bridge_id
                || preparation.request_id != participant.prepare_request_id
                || !matches!(participant.prepare, ParticipantPrepare::Pending)
            {
                return Err(
                    "The Agent Turn preparation write identity is stale or invalid.".into(),
                );
            }
        } else if preparation.is_some() {
            return Err("That Agent Turn preparation write is no longer active.".into());
        }
        *state
            .writer_mutations
            .entry(workspace_root.to_path_buf())
            .or_insert(0) += 1;
        Ok(WriterMutationPermit {
            coordinator: Arc::clone(self),
            workspace_root: workspace_root.to_path_buf(),
            capability: None,
        })
    }

    pub fn begin_workspace_transition(
        self: &Arc<Self>,
        window_label: &str,
        current_root: Option<&Path>,
        target_root: Option<&Path>,
    ) -> Result<WorkspaceTransitionPermit, String> {
        let mut state = self.state.lock();
        if state.workspace_transitions.contains_key(window_label) {
            return Err("That Writer window is already changing Workspace.".into());
        }
        if current_root.is_some_and(|root| state.writer_mutations.contains_key(root)) {
            return Err(
                "Writer is still completing a Workspace mutation; wait before switching.".into(),
            );
        }
        if target_root.is_some_and(|root| state.active.contains_key(root)) {
            return Err("That Workspace has an active Agent Turn; wait before switching.".into());
        }
        state
            .workspace_transitions
            .insert(window_label.to_string(), target_root.map(Path::to_path_buf));
        if let Some(target) = target_root {
            *state
                .transition_targets
                .entry(target.to_path_buf())
                .or_insert(0) += 1;
        }
        if let Some(bridge) = state.bridges.remove(window_label) {
            withdraw_participant_locked(&mut state, window_label, &bridge.bridge_id);
        }
        Ok(WorkspaceTransitionPermit {
            coordinator: Arc::clone(self),
            window_label: window_label.to_string(),
        })
    }

    pub fn register_bridge(
        &self,
        window_label: &str,
        workspace_root: PathBuf,
        workspace_epoch: u64,
        frontend_generation: u64,
    ) -> Result<String, String> {
        let expected = self
            .state
            .lock()
            .bridges
            .get(window_label)
            .map(|b| b.bridge_id.clone());
        self.register_bridge_cas(
            window_label,
            workspace_root,
            workspace_epoch,
            frontend_generation,
            expected.as_deref(),
        )
    }

    pub fn register_bridge_cas(
        &self,
        window_label: &str,
        workspace_root: PathBuf,
        workspace_epoch: u64,
        frontend_generation: u64,
        expected_bridge_id: Option<&str>,
    ) -> Result<String, String> {
        let mut state = self.state.lock();
        if state.workspace_transitions.contains_key(window_label) {
            return Err("That Writer window is changing Workspace.".into());
        }
        if state.active.contains_key(&workspace_root)
            || state.transition_targets.contains_key(&workspace_root)
        {
            return Err("That Workspace already has an active Agent Turn.".into());
        }
        let current = state
            .bridges
            .get(window_label)
            .map(|b| b.bridge_id.as_str());
        if current != expected_bridge_id {
            return Err("Agent Turn bridge CAS failed: current bridge changed.".into());
        }
        if let Some(previous) = state.bridges.remove(window_label) {
            withdraw_participant_locked(&mut state, window_label, &previous.bridge_id);
        }
        let bridge_id = uuid::Uuid::new_v4().to_string();
        state.bridges.insert(
            window_label.to_string(),
            Bridge {
                workspace_root,
                workspace_epoch,
                frontend_generation,
                bridge_id: bridge_id.clone(),
            },
        );
        Ok(bridge_id)
    }

    pub fn reserve(
        &self,
        workspace_root: PathBuf,
        _windows: &[(String, u64)],
    ) -> Result<TurnReservation, String> {
        let mut state = self.state.lock();
        if state.active.contains_key(&workspace_root) {
            return Err(
                "That Workspace already has an active Agent Turn; Writer does not queue sends."
                    .into(),
            );
        }
        if state.writer_mutations.contains_key(&workspace_root) {
            return Err(
                "Writer is still completing a Workspace mutation; try the Agent Turn again.".into(),
            );
        }
        let matching = state
            .bridges
            .iter()
            .filter(|(_, bridge)| bridge.workspace_root == workspace_root)
            .map(|(label, bridge)| {
                (
                    label.clone(),
                    bridge.workspace_epoch,
                    bridge.frontend_generation,
                    bridge.bridge_id.clone(),
                )
            })
            .collect::<Vec<_>>();
        if matching.is_empty() {
            return Err("No ready Writer window is hosting that Workspace.".into());
        }
        let mut participants = HashMap::with_capacity(matching.len());
        for (window_label, workspace_epoch, frontend_generation, bridge_id) in matching {
            participants.insert(
                window_label.clone(),
                Participant {
                    workspace_epoch,
                    frontend_generation,
                    bridge_id,
                    participant_token: uuid::Uuid::new_v4().to_string(),
                    prepare_request_id: uuid::Uuid::new_v4().to_string(),
                    prepare: ParticipantPrepare::Pending,
                    reconcile_request_id: None,
                    reconcile: None,
                },
            );
        }
        let active = Arc::new(ActiveTurn {
            turn_id: uuid::Uuid::new_v4().to_string(),
            workspace_root: workspace_root.clone(),
            state: Mutex::new(ActiveTurnState {
                phase: TurnPhase::Preparing,
                participants,
                pending_permission: None,
                permission_decisions: Vec::new(),
            }),
            changed: Notify::new(),
            cancellation_tx: watch::channel(false).0,
        });
        state.active.insert(workspace_root, active.clone());
        Ok(TurnReservation { inner: active })
    }

    pub fn finish(&self, reservation: &TurnReservation) -> Result<(), String> {
        if !reservation.reconciliation_complete() {
            return Err("The Agent Turn cannot unlock before reconciliation completes.".into());
        }
        let mut state = self.state.lock();
        let current = state
            .active
            .get(&reservation.inner.workspace_root)
            .ok_or_else(|| "The Agent Turn is no longer active.".to_string())?;
        if !Arc::ptr_eq(current, &reservation.inner) {
            return Err("A newer Agent Turn owns that Workspace.".into());
        }
        state.active.remove(&reservation.inner.workspace_root);
        Ok(())
    }

    pub fn is_workspace_active(&self, workspace_root: &Path) -> bool {
        self.state.lock().active.contains_key(workspace_root)
    }

    #[cfg(test)]
    pub fn is_active(&self, workspace_root: &Path) -> bool {
        self.is_workspace_active(workspace_root)
    }

    pub fn withdraw_window(&self, window_label: &str) {
        let mut coordinator = self.state.lock();
        if let Some(bridge) = coordinator.bridges.remove(window_label) {
            withdraw_participant_locked(&mut coordinator, window_label, &bridge.bridge_id);
        }
    }

    pub fn unregister_bridge(
        &self,
        window_label: &str,
        workspace_root: &Path,
        bridge_id: &str,
    ) -> bool {
        let mut state = self.state.lock();
        let matches = state.bridges.get(window_label).is_some_and(|bridge| {
            bridge.workspace_root == workspace_root && bridge.bridge_id == bridge_id
        });
        if matches {
            state.bridges.remove(window_label);
            withdraw_participant_locked(&mut state, window_label, bridge_id);
        }
        matches
    }

    pub fn active(&self, workspace_root: &Path, turn_id: &str) -> Result<TurnReservation, String> {
        let state = self.state.lock();
        let active = state
            .active
            .get(workspace_root)
            .ok_or_else(|| "That Workspace has no active Agent Turn.".to_string())?;
        if active.turn_id != turn_id {
            return Err("The Agent Turn identity is stale.".into());
        }
        Ok(TurnReservation {
            inner: active.clone(),
        })
    }
}

fn validate_common_acknowledgement(
    active: &ActiveTurn,
    participant: &Participant,
    turn_id: &str,
    workspace_root: &str,
    workspace_epoch: u64,
    participant_token: &str,
    bridge_id: &str,
) -> Result<(), String> {
    if turn_id != active.turn_id
        || workspace_root != active.workspace_root.to_string_lossy()
        || workspace_epoch != participant.workspace_epoch
        || participant_token != participant.participant_token
        || bridge_id != participant.bridge_id
    {
        return Err("The Agent Turn acknowledgement identity is stale or invalid.".into());
    }
    Ok(())
}

fn preparation_result(participants: &HashMap<String, Participant>) -> PrepareResult {
    if let Some(error) = participants
        .values()
        .find_map(|participant| match &participant.prepare {
            ParticipantPrepare::Failed(error) => Some(error.clone()),
            _ => None,
        })
    {
        return PrepareResult::Failed(error);
    }
    if participants
        .values()
        .any(|participant| matches!(participant.prepare, ParticipantPrepare::Pending))
    {
        PrepareResult::Pending
    } else {
        PrepareResult::Ready
    }
}

fn reconciliation_complete(participants: &HashMap<String, Participant>) -> bool {
    participants
        .values()
        .all(|participant| match participant.prepare {
            ParticipantPrepare::Prepared(_) => {
                participant.reconcile == Some(ReconcileResult::Completed)
            }
            ParticipantPrepare::Failed(_) => true,
            ParticipantPrepare::Pending => false,
        })
}

fn withdraw_participant_locked(
    coordinator: &mut CoordinatorState,
    window_label: &str,
    bridge_id: &str,
) {
    for (_workspace_root, turn) in &coordinator.active {
        let mut state = turn.state.lock();
        let belongs_to_bridge = state
            .participants
            .get(window_label)
            .is_some_and(|participant| participant.bridge_id == bridge_id);
        if !belongs_to_bridge {
            continue;
        }
        state.participants.remove(window_label);
        if state.participants.is_empty() {
            let _ = turn.cancellation_tx.send(true);
            if let Some(mut pending) = state.pending_permission.take() {
                if let Some(response) = pending.response.take() {
                    let _ = response.send(None);
                }
            }
        }
        drop(state);
        turn.changed.notify_waiters();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn prepare_ack(
        request: &LifecycleRequest,
        lease: Option<FrontendLeaseIdentity>,
        error: Option<&str>,
    ) -> PrepareAcknowledgement {
        PrepareAcknowledgement {
            turn_id: request.turn_id.clone(),
            workspace_root: request.workspace_root.clone(),
            workspace_epoch: request.workspace_epoch,
            participant_token: request.participant_token.clone(),
            bridge_id: request.bridge_id.clone(),
            request_id: request.request_id.clone(),
            lease,
            error: error.map(str::to_string),
        }
    }

    #[test]
    fn partial_prepare_failure_never_runs_and_reconciles_only_acquired_leases() {
        let coordinator = Arc::new(AgentCoordinator::default());
        let root = PathBuf::from("/workspace");
        coordinator
            .register_bridge("first", root.clone(), 4, 10)
            .unwrap();
        coordinator
            .register_bridge("second", root.clone(), 7, 20)
            .unwrap();
        let turn = coordinator
            .reserve(root.clone(), &[("first".into(), 4), ("second".into(), 7)])
            .unwrap();
        let requests = turn.prepare_requests();
        let first = requests
            .iter()
            .find(|request| request.window_label == "first")
            .unwrap();
        let second = requests
            .iter()
            .find(|request| request.window_label == "second")
            .unwrap();
        let lease = FrontendLeaseIdentity {
            generation: 10,
            id: 91,
        };

        assert_eq!(
            turn.acknowledge_prepare("first", prepare_ack(first, Some(lease.clone()), None))
                .unwrap(),
            PrepareResult::Pending
        );
        assert!(turn
            .acknowledge_prepare("second", prepare_ack(second, None, Some("save failed")))
            .is_ok());
        assert_eq!(
            turn.preparation_result(),
            PrepareResult::Failed("save failed".into())
        );
        assert_ne!(turn.phase(), TurnPhase::Running);

        let reconcile = turn.begin_reconciliation();
        assert_eq!(reconcile.len(), 1);
        assert_eq!(reconcile[0].window_label, "first");
        assert_eq!(reconcile[0].lease.as_ref(), Some(&lease));
        let request = &reconcile[0];
        assert!(turn
            .acknowledge_reconcile(
                "first",
                ReconcileAcknowledgement {
                    turn_id: request.turn_id.clone(),
                    workspace_root: request.workspace_root.clone(),
                    workspace_epoch: request.workspace_epoch,
                    participant_token: request.participant_token.clone(),
                    bridge_id: request.bridge_id.clone(),
                    request_id: request.request_id.clone(),
                    lease,
                    result: ReconcileResult::Completed,
                },
            )
            .unwrap());
        assert!(turn.reconciliation_complete());
        coordinator.finish(&turn).unwrap();
        assert!(!coordinator.is_active(&root));
    }

    #[test]
    fn reconciliation_owner_withdrawal_keeps_active_until_terminal_driver_finish() {
        let coordinator = AgentCoordinator::default();
        let root = PathBuf::from("/workspace");
        coordinator
            .register_bridge("writer", root.clone(), 3, 8)
            .unwrap();
        let turn = coordinator
            .reserve(root.clone(), &[("writer".into(), 3)])
            .unwrap();
        let prepare = turn.prepare_requests().pop().unwrap();
        turn.acknowledge_prepare(
            "writer",
            prepare_ack(
                &prepare,
                Some(FrontendLeaseIdentity {
                    generation: 8,
                    id: 2,
                }),
                None,
            ),
        )
        .unwrap();
        turn.begin_reconciliation();
        assert!(coordinator.is_active(&root));

        coordinator.withdraw_window("writer");

        // Withdrawal during reconciliation must not release the workspace slot;
        // only the driver may finish after publishing a terminal result.
        assert!(coordinator.is_active(&root));
    }

    #[test]
    fn one_participant_withdrawal_does_not_cancel_remaining_workspace_participants() {
        let coordinator = AgentCoordinator::default();
        let root = PathBuf::from("/workspace");
        coordinator
            .register_bridge("first", root.clone(), 1, 1)
            .unwrap();
        coordinator
            .register_bridge("second", root.clone(), 2, 2)
            .unwrap();
        let turn = coordinator
            .reserve(root, &[("first".into(), 1), ("second".into(), 2)])
            .unwrap();
        let cancellation = turn.cancellation_receiver();

        coordinator.withdraw_window("first");

        assert!(!*cancellation.borrow());
        assert_eq!(turn.prepare_requests().len(), 1);
        coordinator.withdraw_window("second");
        assert!(*cancellation.borrow());
    }

    #[test]
    fn replacing_a_window_bridge_withdraws_only_the_old_identity() {
        let coordinator = AgentCoordinator::default();
        let old_root = PathBuf::from("/old");
        let new_root = PathBuf::from("/new");
        let old_bridge = coordinator
            .register_bridge("writer", old_root.clone(), 1, 1)
            .unwrap();
        let old_turn = coordinator
            .reserve(old_root.clone(), &[("writer".into(), 1)])
            .unwrap();
        let cancellation = old_turn.cancellation_receiver();

        let new_bridge = coordinator
            .register_bridge("writer", new_root.clone(), 2, 2)
            .unwrap();

        assert!(*cancellation.borrow());
        assert!(!coordinator.unregister_bridge("writer", &old_root, &old_bridge));
        assert!(coordinator
            .reserve(new_root.clone(), &[("writer".into(), 2)])
            .is_ok());
        assert!(coordinator.unregister_bridge("writer", &new_root, &new_bridge));
    }

    #[test]
    fn bridge_registration_allows_reload_generation_reset_and_is_transition_barriered() {
        let coordinator = Arc::new(AgentCoordinator::default());
        let root = PathBuf::from("/workspace");
        coordinator
            .register_bridge("writer", root.clone(), 1, 5)
            .unwrap();
        coordinator
            .register_bridge("writer", root.clone(), 1, 4)
            .unwrap();
        let transition = coordinator
            .begin_workspace_transition("writer", None, Some(&root))
            .unwrap();
        assert!(coordinator
            .register_bridge("writer", root.clone(), 2, 6)
            .is_err());
        drop(transition);
        coordinator.register_bridge("writer", root, 2, 6).unwrap();
    }

    #[test]
    fn transition_to_active_target_workspace_is_rejected_under_coordinator_lock() {
        let coordinator = Arc::new(AgentCoordinator::default());
        let root = PathBuf::from("/workspace");
        coordinator
            .register_bridge("writer", root.clone(), 1, 1)
            .unwrap();
        let _turn = coordinator
            .reserve(root.clone(), &[("writer".into(), 1)])
            .unwrap();
        assert!(coordinator
            .begin_workspace_transition("other", None, Some(&root))
            .is_err());
    }

    #[test]
    fn failed_reconciliation_remains_blocking() {
        let coordinator = AgentCoordinator::default();
        let root = PathBuf::from("/workspace");
        coordinator
            .register_bridge("writer", root.clone(), 3, 8)
            .unwrap();
        let turn = coordinator
            .reserve(root.clone(), &[("writer".into(), 3)])
            .unwrap();
        let prepare = turn.prepare_requests().pop().unwrap();
        turn.acknowledge_prepare(
            "writer",
            prepare_ack(
                &prepare,
                Some(FrontendLeaseIdentity {
                    generation: 8,
                    id: 2,
                }),
                None,
            ),
        )
        .unwrap();
        let reconcile = turn.begin_reconciliation().pop().unwrap();
        assert!(!turn
            .acknowledge_reconcile(
                "writer",
                ReconcileAcknowledgement {
                    turn_id: reconcile.turn_id,
                    workspace_root: reconcile.workspace_root,
                    workspace_epoch: reconcile.workspace_epoch,
                    participant_token: reconcile.participant_token,
                    bridge_id: reconcile.bridge_id,
                    request_id: reconcile.request_id,
                    lease: reconcile.lease.unwrap(),
                    result: ReconcileResult::Failed,
                },
            )
            .unwrap());
        assert!(!turn.reconciliation_complete());
        assert!(coordinator.finish(&turn).is_err());
        assert!(coordinator.is_active(&root));
    }

    #[tokio::test]
    async fn permission_decision_is_exact_one_shot_and_scoped_to_a_participant() {
        let coordinator = AgentCoordinator::default();
        let root = PathBuf::from("/workspace");
        coordinator
            .register_bridge("writer", root.clone(), 3, 8)
            .unwrap();
        let turn = coordinator.reserve(root, &[("writer".into(), 3)]).unwrap();
        let prepare = turn.prepare_requests().pop().unwrap();
        turn.acknowledge_prepare(
            "writer",
            prepare_ack(
                &prepare,
                Some(FrontendLeaseIdentity {
                    generation: 8,
                    id: 2,
                }),
                None,
            ),
        )
        .unwrap();
        turn.mark_running().unwrap();
        let (response_tx, response_rx) = oneshot::channel();
        let request = turn
            .begin_permission(
                "Access the network".into(),
                vec![TurnPermissionOption {
                    id: "allow-once".into(),
                    name: "Allow once".into(),
                    kind: "allow-once".into(),
                }],
                response_tx,
            )
            .unwrap();

        assert!(turn
            .respond_permission(
                "other-window",
                &request.request_id,
                Some("allow-once".into())
            )
            .is_err());
        assert!(turn
            .respond_permission("writer", &request.request_id, Some("not-offered".into()))
            .is_err());
        turn.respond_permission("writer", &request.request_id, Some("allow-once".into()))
            .unwrap();
        assert!(turn
            .respond_permission("writer", &request.request_id, Some("allow-once".into()))
            .is_err());
        assert_eq!(response_rx.await.unwrap(), Some("allow-once".into()));
        assert_eq!(turn.phase(), TurnPhase::Running);
    }
}

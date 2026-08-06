use super::{probe::terminate_and_reap, BoundCustomExecutable};
use agent_client_protocol::schema::{
    v1::{
        ContentBlock, InitializeRequest, NewSessionRequest, PermissionOptionKind, PromptRequest,
        RequestPermissionOutcome, RequestPermissionRequest, RequestPermissionResponse,
        SelectedPermissionOutcome, SessionNotification, SessionUpdate, StopReason, TextContent,
        ToolCallStatus,
    },
    ProtocolVersion,
};
use agent_client_protocol::{Agent, Client, ConnectionTo, Lines};
use parking_lot::Mutex;
use std::io;
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdout, Command};
use tokio::sync::{mpsc, oneshot, watch};

const MAX_PROTOCOL_LINE_BYTES: usize = 1024 * 1024;
const MAX_PROJECTED_TEXT_BYTES: usize = 2 * 1024 * 1024;
const MAX_CHANGE_SUMMARIES: usize = 128;
const MAX_CHANGE_SUMMARY_BYTES: usize = 4 * 1024;
const MAX_STDERR_BYTES: u64 = 16 * 1024;
const STDERR_DRAIN_TIMEOUT: Duration = Duration::from_millis(100);
const PERMISSION_TIMEOUT: Duration = Duration::from_secs(10 * 60);
const NOTIFICATION_DRAIN_TIMEOUT: Duration = Duration::from_secs(1);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuntimeUpdate {
    Text(String),
    ChangeSummary(String),
    PermissionResolved,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeOutcome {
    pub output: String,
    pub change_summaries: Vec<String>,
    pub stop_reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimePermissionOption {
    pub id: String,
    pub name: String,
    pub kind: String,
}

pub struct RuntimePermissionRequest {
    pub title: String,
    pub options: Vec<RuntimePermissionOption>,
    pub response: oneshot::Sender<Option<String>>,
}

pub struct RuntimeChannels {
    pub updates: mpsc::UnboundedSender<RuntimeUpdate>,
    pub permissions: mpsc::UnboundedSender<RuntimePermissionRequest>,
}

pub async fn run_bound_agent_turn(
    bound: BoundCustomExecutable,
    args: &[String],
    workspace_root: &Path,
    prompt: &str,
    channels: RuntimeChannels,
    cancellation: watch::Receiver<bool>,
    deadline: Duration,
) -> Result<RuntimeOutcome, String> {
    let result = run_agent_turn_process(
        bound.path(),
        args,
        workspace_root,
        prompt,
        channels,
        cancellation,
        deadline,
    )
    .await;
    match (result, bound.close()) {
        (Ok(outcome), Ok(())) => Ok(outcome),
        (Err(error), Ok(())) => Err(error),
        (Ok(_), Err(error)) => Err(format!(
            "Agent Turn artifact cleanup could not be confirmed: {error}"
        )),
        (Err(runtime), Err(cleanup)) => Err(format!(
            "{runtime} Agent Turn artifact cleanup could not be confirmed: {cleanup}"
        )),
    }
}

pub async fn run_agent_turn(
    command: &Path,
    args: &[String],
    workspace_root: &Path,
    prompt: &str,
    channels: RuntimeChannels,
    cancellation: watch::Receiver<bool>,
    deadline: Duration,
) -> Result<RuntimeOutcome, String> {
    run_agent_turn_process(
        command,
        args,
        workspace_root,
        prompt,
        channels,
        cancellation,
        deadline,
    )
    .await
}

#[derive(Default)]
struct RuntimeProjection {
    session_id: Option<String>,
    output: String,
    change_summaries: Vec<String>,
}

async fn run_agent_turn_process(
    command: &Path,
    args: &[String],
    workspace_root: &Path,
    prompt: &str,
    channels: RuntimeChannels,
    mut cancellation: watch::Receiver<bool>,
    deadline: Duration,
) -> Result<RuntimeOutcome, String> {
    let RuntimeChannels {
        updates,
        permissions,
    } = channels;
    if *cancellation.borrow() {
        return Err("Agent Turn cancelled because a Workspace window closed.".into());
    }
    let mut process = Command::new(command);
    process
        .args(args)
        .current_dir(workspace_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt as _;
        process.as_std_mut().process_group(0);
    }
    let mut child = process
        .spawn()
        .map_err(|error| format!("Could not start the selected Agent: {error}"))?;
    let pid = child.id();
    let stdin = child.stdin.take().expect("piped Agent stdin is present");
    let stdout = child.stdout.take().expect("piped Agent stdout is present");
    let stderr = child.stderr.take().expect("piped Agent stderr is present");
    let mut stderr_task = tokio::spawn(async move {
        let mut bytes = Vec::new();
        let _ = stderr.take(MAX_STDERR_BYTES).read_to_end(&mut bytes).await;
        String::from_utf8_lossy(&bytes).trim().to_string()
    });

    let outgoing = futures::sink::unfold(stdin, |mut stdin, line: String| async move {
        stdin.write_all(line.as_bytes()).await?;
        stdin.write_all(b"\n").await?;
        stdin.flush().await?;
        Ok::<_, io::Error>(stdin)
    });
    let raw_session_updates = Arc::new(AtomicUsize::new(0));
    let incoming_session_updates = raw_session_updates.clone();
    let incoming = futures::stream::try_unfold(BufReader::new(stdout), move |mut reader| {
        let incoming_session_updates = incoming_session_updates.clone();
        async move {
            match read_bounded_line(&mut reader).await? {
                Some(line) => {
                    if is_session_update_line(&line) {
                        incoming_session_updates.fetch_add(1, Ordering::Release);
                    }
                    Ok(Some((line, reader)))
                }
                None => Ok(None),
            }
        }
    });
    let transport = Lines::new(outgoing, incoming);
    let projection = Arc::new(Mutex::new(RuntimeProjection::default()));
    let notification_projection = projection.clone();
    let notification_updates = updates.clone();
    let processed_session_updates = Arc::new(AtomicUsize::new(0));
    let notification_processed_updates = processed_session_updates.clone();
    let notifications_processed = Arc::new(tokio::sync::Notify::new());
    let notification_completed = notifications_processed.clone();
    let session_projection = projection.clone();
    let permission_projection = projection.clone();
    let permission_updates = updates.clone();
    let workspace_root = workspace_root.to_path_buf();
    let prompt = prompt.to_string();

    let protocol = Client
        .builder()
        .on_receive_notification(
            async move |notification: SessionNotification, _cx| {
                let result = project_notification(
                    notification,
                    &notification_projection,
                    &notification_updates,
                );
                notification_processed_updates.fetch_add(1, Ordering::Release);
                notification_completed.notify_waiters();
                result.map_err(|message| {
                    agent_client_protocol::Error::into_internal_error(io::Error::other(message))
                })
            },
            agent_client_protocol::on_receive_notification!(),
        )
        .on_receive_request(
            async move |request: RequestPermissionRequest, responder, _cx| {
                let expected_session = permission_projection.lock().session_id.clone();
                if expected_session.as_deref() != Some(request.session_id.0.as_ref()) {
                    return responder.respond(RequestPermissionResponse::new(
                        RequestPermissionOutcome::Cancelled,
                    ));
                }
                let title = request
                    .tool_call
                    .fields
                    .title
                    .unwrap_or_else(|| "External action".into());
                let options = request
                    .options
                    .iter()
                    .filter_map(|option| {
                        permission_kind_wire(option.kind).map(|kind| RuntimePermissionOption {
                            id: option.option_id.0.to_string(),
                            name: option.name.clone(),
                            kind: kind.into(),
                        })
                    })
                    .collect::<Vec<_>>();
                if options.is_empty() {
                    return responder.respond(RequestPermissionResponse::new(
                        RequestPermissionOutcome::Cancelled,
                    ));
                }
                let (response_tx, response_rx) = oneshot::channel();
                if permissions
                    .send(RuntimePermissionRequest {
                        title,
                        options,
                        response: response_tx,
                    })
                    .is_err()
                {
                    return responder.respond(RequestPermissionResponse::new(
                        RequestPermissionOutcome::Cancelled,
                    ));
                }
                let outcome = match tokio::time::timeout(PERMISSION_TIMEOUT, response_rx).await {
                    Ok(Ok(Some(option_id))) => RequestPermissionOutcome::Selected(
                        SelectedPermissionOutcome::new(option_id),
                    ),
                    _ => RequestPermissionOutcome::Cancelled,
                };
                let _ = permission_updates.send(RuntimeUpdate::PermissionResolved);
                responder.respond(RequestPermissionResponse::new(outcome))
            },
            agent_client_protocol::on_receive_request!(),
        )
        .connect_with(transport, |connection: ConnectionTo<Agent>| async move {
            let initialized = connection
                .send_request(InitializeRequest::new(ProtocolVersion::V1))
                .block_task()
                .await?;
            if initialized.protocol_version != ProtocolVersion::V1 {
                return Err(agent_client_protocol::Error::into_internal_error(
                    io::Error::other(format!(
                        "Agent negotiated unsupported ACP protocol version {}",
                        initialized.protocol_version
                    )),
                ));
            }
            if !initialized.agent_capabilities.load_session {
                return Err(agent_client_protocol::Error::into_internal_error(
                    io::Error::other("Agent no longer advertises required session restoration"),
                ));
            }
            let session = connection
                .send_request(NewSessionRequest::new(workspace_root))
                .block_task()
                .await?;
            session_projection.lock().session_id = Some(session.session_id.0.to_string());
            let response = connection
                .send_request(PromptRequest::new(
                    session.session_id,
                    vec![ContentBlock::Text(TextContent::new(prompt))],
                ))
                .block_task()
                .await?;
            let _ = tokio::time::timeout(NOTIFICATION_DRAIN_TIMEOUT, connection.incoming_closed())
                .await;
            Ok(response.stop_reason)
        });

    let response = if *cancellation.borrow() {
        Err("Agent Turn cancelled because a Workspace window closed.".into())
    } else {
        tokio::select! {
            result = tokio::time::timeout(deadline, protocol) => result
                .map_err(|_| format!("Agent Turn timed out after {} ms.", deadline.as_millis()))
                .and_then(|result| result.map_err(|error| format!("ACP Agent Turn failed: {error}"))),
            _ = cancellation.changed() => Err("Agent Turn cancelled because a Workspace window closed.".into()),
        }
    };
    // `protocol` owns the ACP transport. Once it resolves, dropping it closes
    // the outgoing stdin side; wait for the agent's orderly EOF/exit so any
    // tail session updates already written to stdout are consumed by the
    // incoming reader before cleanup.
    let notification_drain = wait_for_session_updates(
        &raw_session_updates,
        &processed_session_updates,
        &notifications_processed,
    )
    .await;
    let cleanup = terminate_and_reap(&mut child, pid).await;
    let stderr = match tokio::time::timeout(STDERR_DRAIN_TIMEOUT, &mut stderr_task).await {
        Ok(result) => result.unwrap_or_default(),
        Err(_) => {
            stderr_task.abort();
            let _ = stderr_task.await;
            String::new()
        }
    };
    if let Err(error) = cleanup {
        return Err(format!("Agent cleanup could not be confirmed: {error}"));
    }
    notification_drain?;
    let stop_reason = match response {
        Ok(stop_reason) => stop_reason,
        Err(error) if stderr.is_empty() => return Err(error),
        Err(error) => return Err(format!("{error} Agent stderr: {stderr}")),
    };
    if !matches!(stop_reason, StopReason::EndTurn) {
        return Err(format!(
            "Agent Turn stopped without completing: {}",
            stop_reason_name(&stop_reason)
        ));
    }
    let projection = projection.lock();
    Ok(RuntimeOutcome {
        output: projection.output.clone(),
        change_summaries: projection.change_summaries.clone(),
        stop_reason: stop_reason_name(&stop_reason).into(),
    })
}

fn permission_kind_wire(kind: PermissionOptionKind) -> Option<&'static str> {
    match kind {
        PermissionOptionKind::AllowOnce => Some("allow-once"),
        PermissionOptionKind::RejectOnce => Some("reject-once"),
        PermissionOptionKind::AllowAlways | PermissionOptionKind::RejectAlways => None,
        _ => None,
    }
}

fn is_session_update_line(line: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(line)
        .ok()
        .and_then(|value| {
            value
                .get("method")
                .and_then(|method| method.as_str())
                .map(str::to_owned)
        })
        .as_deref()
        == Some("session/update")
}

async fn wait_for_session_updates(
    received: &AtomicUsize,
    processed: &AtomicUsize,
    completed: &tokio::sync::Notify,
) -> Result<(), String> {
    tokio::time::timeout(NOTIFICATION_DRAIN_TIMEOUT, async {
        loop {
            let notified = completed.notified();
            let received_now = received.load(Ordering::Acquire);
            let processed_now = processed.load(Ordering::Acquire);
            if processed_now >= received_now {
                if processed_now == received_now {
                    return;
                }
            }
            tokio::select! {
                _ = notified => {},
                _ = tokio::time::sleep(Duration::from_millis(10)) => {},
            }
        }
    })
    .await
    .map_err(|_| "ACP session updates did not finish projecting before turn cleanup.".to_string())
}

async fn read_bounded_line(reader: &mut BufReader<ChildStdout>) -> io::Result<Option<String>> {
    let mut bytes = Vec::new();
    loop {
        let available = reader.fill_buf().await?;
        if available.is_empty() {
            if bytes.is_empty() {
                return Ok(None);
            }
            break;
        }
        let take = available
            .iter()
            .position(|byte| *byte == b'\n')
            .map_or(available.len(), |index| index + 1);
        if bytes.len() + take > MAX_PROTOCOL_LINE_BYTES {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "ACP protocol line exceeded the 1 MiB limit",
            ));
        }
        bytes.extend_from_slice(&available[..take]);
        reader.consume(take);
        if bytes.last() == Some(&b'\n') {
            bytes.pop();
            if bytes.last() == Some(&b'\r') {
                bytes.pop();
            }
            break;
        }
    }
    String::from_utf8(bytes)
        .map(Some)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
}

fn project_notification(
    notification: SessionNotification,
    projection: &Arc<Mutex<RuntimeProjection>>,
    updates: &mpsc::UnboundedSender<RuntimeUpdate>,
) -> Result<(), String> {
    let mut projection = projection.lock();
    let expected_session = projection
        .session_id
        .as_deref()
        .ok_or_else(|| "Agent sent a session update before creating the session.".to_string())?;
    if notification.session_id.0.as_ref() != expected_session {
        return Err("Agent sent an update for a different ACP session.".into());
    }
    match notification.update {
        SessionUpdate::AgentMessageChunk(chunk) => {
            if let ContentBlock::Text(text) = chunk.content {
                if projection.output.len() + text.text.len() > MAX_PROJECTED_TEXT_BYTES {
                    return Err("Agent output exceeded the 2 MiB presentation limit.".into());
                }
                projection.output.push_str(&text.text);
                let _ = updates.send(RuntimeUpdate::Text(text.text));
            }
        }
        SessionUpdate::ToolCall(tool_call)
            if tool_call.status == ToolCallStatus::Completed
                && !tool_call.title.is_empty()
                && tool_call.title.len() <= MAX_CHANGE_SUMMARY_BYTES
                && projection.change_summaries.len() < MAX_CHANGE_SUMMARIES =>
        {
            if !projection.change_summaries.contains(&tool_call.title) {
                projection.change_summaries.push(tool_call.title.clone());
                let _ = updates.send(RuntimeUpdate::ChangeSummary(tool_call.title));
            }
        }
        SessionUpdate::ToolCallUpdate(update)
            if update.fields.status == Some(ToolCallStatus::Completed) =>
        {
            if let Some(title) = update.fields.title {
                if !title.is_empty()
                    && title.len() <= MAX_CHANGE_SUMMARY_BYTES
                    && projection.change_summaries.len() < MAX_CHANGE_SUMMARIES
                    && !projection.change_summaries.contains(&title)
                {
                    projection.change_summaries.push(title.clone());
                    let _ = updates.send(RuntimeUpdate::ChangeSummary(title));
                }
            }
        }
        _ => {}
    }
    Ok(())
}

fn stop_reason_name(reason: &StopReason) -> &'static str {
    match reason {
        StopReason::EndTurn => "end-turn",
        StopReason::MaxTokens => "max-tokens",
        StopReason::MaxTurnRequests => "max-turn-requests",
        StopReason::Refusal => "refusal",
        StopReason::Cancelled => "cancelled",
        _ => "unknown",
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use crate::assistant::{
        bind_custom_executable, build_native_fake_agent, fake_agent_artifact_path, BindingControl,
    };
    use std::fs;

    #[tokio::test]
    async fn sdk_turn_streams_writes_and_cleans_the_process_and_bound_artifact() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir_all(&workspace).unwrap();
        let source = build_native_fake_agent(dir.path(), "turn_success");
        let pid_path = fake_agent_artifact_path(&source, "pids");
        let bound =
            bind_custom_executable(&source.to_string_lossy(), &[], &BindingControl::new(None))
                .unwrap()
                .unwrap();
        let artifact = bound.path().to_path_buf();
        let (update_tx, mut update_rx) = mpsc::unbounded_channel();
        let (permission_tx, _permission_rx) = mpsc::unbounded_channel();
        let (_cancel_tx, cancel_rx) = watch::channel(false);

        let outcome = run_bound_agent_turn(
            bound,
            &[],
            &workspace,
            "Update the Workspace",
            RuntimeChannels {
                updates: update_tx,
                permissions: permission_tx,
            },
            cancel_rx,
            Duration::from_secs(5),
        )
        .await
        .unwrap();

        let updates = std::iter::from_fn(|| update_rx.try_recv().ok()).collect::<Vec<_>>();
        assert!(updates.contains(&RuntimeUpdate::Text("Turn complete".into())));
        assert!(updates.contains(&RuntimeUpdate::ChangeSummary(
            "Updated agent-change.md".into()
        )));
        assert_eq!(outcome.output, "Turn complete");
        assert_eq!(outcome.change_summaries, vec!["Updated agent-change.md"]);
        assert_eq!(outcome.stop_reason, "end-turn");
        assert_eq!(
            fs::read_to_string(workspace.join("agent-change.md")).unwrap(),
            "# Written by fake Agent\n"
        );
        assert!(
            !artifact.exists(),
            "private Agent artifact survived the turn"
        );

        let pids = fs::read_to_string(pid_path).unwrap();
        for pid in pids.lines() {
            let status = std::process::Command::new("/bin/kill")
                .args(["-0", pid])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .unwrap();
            assert!(
                !status.success(),
                "fake Agent process {pid} survived cleanup"
            );
        }
    }

    #[tokio::test]
    async fn sdk_keeps_connection_open_for_tail_updates_after_prompt_response() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir_all(&workspace).unwrap();
        let source = build_native_fake_agent(dir.path(), "turn_tail");
        let bound =
            bind_custom_executable(&source.to_string_lossy(), &[], &BindingControl::new(None))
                .unwrap()
                .unwrap();
        let (updates, mut rx) = mpsc::unbounded_channel();
        let (permissions, _permission_rx) = mpsc::unbounded_channel();
        let (_cancel, cancellation) = watch::channel(false);
        let outcome = run_bound_agent_turn(
            bound,
            &[],
            &workspace,
            "tail",
            RuntimeChannels {
                updates,
                permissions,
            },
            cancellation,
            Duration::from_secs(5),
        )
        .await
        .unwrap();
        let seen = std::iter::from_fn(|| rx.try_recv().ok()).collect::<Vec<_>>();
        assert!(seen.contains(&RuntimeUpdate::Text("Turn complete".into())));
        assert_eq!(outcome.stop_reason, "end-turn");
    }

    #[tokio::test]
    async fn workspace_withdrawal_cancels_and_reaps_a_hanging_bound_agent() {
        let dir = tempfile::tempdir().unwrap();
        let workspace = dir.path().join("workspace");
        fs::create_dir_all(&workspace).unwrap();
        let source = build_native_fake_agent(dir.path(), "turn_hang");
        let pid_path = fake_agent_artifact_path(&source, "pids");
        let bound =
            bind_custom_executable(&source.to_string_lossy(), &[], &BindingControl::new(None))
                .unwrap()
                .unwrap();
        let artifact = bound.path().to_path_buf();
        let (update_tx, _update_rx) = mpsc::unbounded_channel();
        let (permission_tx, _permission_rx) = mpsc::unbounded_channel();
        let (cancel_tx, cancel_rx) = watch::channel(false);
        let turn = tokio::spawn(async move {
            run_bound_agent_turn(
                bound,
                &[],
                &workspace,
                "Wait forever",
                RuntimeChannels {
                    updates: update_tx,
                    permissions: permission_tx,
                },
                cancel_rx,
                Duration::from_secs(20),
            )
            .await
        });
        tokio::time::timeout(Duration::from_secs(3), async {
            while !pid_path.exists() {
                tokio::task::yield_now().await;
            }
        })
        .await
        .unwrap();

        cancel_tx.send(true).unwrap();
        let error = tokio::time::timeout(Duration::from_secs(3), turn)
            .await
            .unwrap()
            .unwrap()
            .unwrap_err();

        assert!(error.contains("cancelled"), "unexpected error: {error}");
        assert!(
            !artifact.exists(),
            "private Agent artifact survived cancellation"
        );
        for pid in fs::read_to_string(pid_path).unwrap().lines() {
            let status = std::process::Command::new("/bin/kill")
                .args(["-0", pid])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .unwrap();
            assert!(
                !status.success(),
                "fake Agent process {pid} survived cancellation"
            );
        }
    }

    #[test]
    fn persistent_permission_choices_are_never_forwarded_to_writer() {
        assert_eq!(
            permission_kind_wire(PermissionOptionKind::AllowOnce),
            Some("allow-once")
        );
        assert_eq!(
            permission_kind_wire(PermissionOptionKind::RejectOnce),
            Some("reject-once")
        );
        assert_eq!(
            permission_kind_wire(PermissionOptionKind::AllowAlways),
            None
        );
        assert_eq!(
            permission_kind_wire(PermissionOptionKind::RejectAlways),
            None
        );
    }

    #[tokio::test(flavor = "current_thread")]
    async fn delayed_session_update_after_prompt_response_is_drained_before_cleanup() {
        let received = Arc::new(AtomicUsize::new(0));
        let processed = Arc::new(AtomicUsize::new(0));
        let completed = Arc::new(tokio::sync::Notify::new());
        let received_task = received.clone();
        let processed_task = processed.clone();
        let completed_task = completed.clone();
        tokio::spawn(async move {
            received_task.store(1, Ordering::Release);
            processed_task.store(1, Ordering::Release);
            completed_task.notify_waiters();
        });
        completed.notified().await;
        wait_for_session_updates(&received, &processed, &completed)
            .await
            .unwrap();
        assert_eq!(received.load(Ordering::Acquire), 1);
        assert_eq!(processed.load(Ordering::Acquire), 1);
    }
}

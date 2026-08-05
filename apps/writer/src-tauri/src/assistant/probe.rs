use agent_client_protocol::schema::{
    v1::{InitializeRequest, InitializeResponse},
    ProtocolVersion,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::time::timeout;

use super::BoundCustomExecutable;

const MAX_PROTOCOL_LINE_BYTES: u64 = 1024 * 1024;
const MAX_STDERR_BYTES: u64 = 16 * 1024;
const CHILD_REAP_TIMEOUT: Duration = Duration::from_secs(2);
const STDERR_DRAIN_TIMEOUT: Duration = Duration::from_millis(100);
const AUTH_REQUIRED_CODE: i64 = -32_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentStatus {
    Compatible,
    Missing,
    AuthenticationRequired,
    Incompatible,
    HandshakeFailed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInfo {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthMethodInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeResult {
    pub status: AgentStatus,
    pub message: String,
    pub missing_capabilities: Vec<String>,
    pub agent_info: Option<AgentInfo>,
    pub auth_methods: Vec<AuthMethodInfo>,
}

impl ProbeResult {
    pub(crate) fn failed(status: AgentStatus, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
            missing_capabilities: Vec::new(),
            agent_info: None,
            auth_methods: Vec::new(),
        }
    }
}

pub async fn probe_bound_agent(
    bound: BoundCustomExecutable,
    args: &[String],
    deadline: Duration,
) -> ProbeResult {
    probe_bound_agent_inner(bound, args, deadline, None).await
}

pub async fn probe_bound_agent_for_epoch(
    bound: BoundCustomExecutable,
    args: &[String],
    deadline: Duration,
    epoch: Arc<AtomicU64>,
    expected_epoch: u64,
) -> ProbeResult {
    probe_bound_agent_inner(bound, args, deadline, Some((epoch, expected_epoch))).await
}

async fn probe_bound_agent_inner(
    bound: BoundCustomExecutable,
    args: &[String],
    deadline: Duration,
    cancellation: Option<(Arc<AtomicU64>, u64)>,
) -> ProbeResult {
    let command = bound.path().to_string_lossy().into_owned();
    let result = probe_agent_inner(&command, args, deadline, cancellation).await;
    match bound.close() {
        Ok(()) => result,
        Err(error) => ProbeResult::failed(
            AgentStatus::HandshakeFailed,
            format!("Agent probe artifact cleanup could not be confirmed: {error}"),
        ),
    }
}

#[derive(Deserialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: serde_json::Value,
    result: Option<InitializeResponse>,
    error: Option<JsonRpcError>,
}

#[derive(Deserialize)]
struct JsonRpcError {
    code: i64,
    message: String,
}

pub async fn probe_agent(command: &str, args: &[String], deadline: Duration) -> ProbeResult {
    probe_agent_inner(command, args, deadline, None).await
}

pub async fn probe_agent_for_epoch(
    command: &str,
    args: &[String],
    deadline: Duration,
    epoch: Arc<AtomicU64>,
    expected_epoch: u64,
) -> ProbeResult {
    probe_agent_inner(command, args, deadline, Some((epoch, expected_epoch))).await
}

async fn probe_agent_inner(
    command: &str,
    args: &[String],
    deadline: Duration,
    cancellation: Option<(Arc<AtomicU64>, u64)>,
) -> ProbeResult {
    if cancellation
        .as_ref()
        .is_some_and(|(epoch, expected)| epoch.load(Ordering::Acquire) != *expected)
    {
        return ProbeResult::failed(
            AgentStatus::HandshakeFailed,
            "Agent discovery was superseded by a newer Workspace request.",
        );
    }

    let mut process = Command::new(command);
    process
        .args(args)
        .current_dir(std::env::temp_dir())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt as _;
        process.as_std_mut().process_group(0);
    }

    let mut child = match process.spawn() {
        Ok(child) => child,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return ProbeResult::failed(
                AgentStatus::Missing,
                format!("Executable `{command}` was not found. Install it, then retry."),
            );
        }
        Err(error) => {
            return ProbeResult::failed(
                AgentStatus::HandshakeFailed,
                format!("Could not start `{command}`: {error}"),
            );
        }
    };
    let pid = child.id();
    let mut stdin = child.stdin.take().expect("piped stdin is present");
    let stdout = child.stdout.take().expect("piped stdout is present");
    let stderr = child.stderr.take().expect("piped stderr is present");
    let mut stderr_task = tokio::spawn(async move {
        let mut bytes = Vec::new();
        let _ = stderr.take(MAX_STDERR_BYTES).read_to_end(&mut bytes).await;
        String::from_utf8_lossy(&bytes).trim().to_string()
    });

    let request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": InitializeRequest::new(ProtocolVersion::V1),
    });
    let protocol = async {
        let mut payload = serde_json::to_vec(&request)
            .map_err(|error| format!("Could not encode ACP initialize request: {error}"))?;
        payload.push(b'\n');
        stdin
            .write_all(&payload)
            .await
            .map_err(|error| format!("Could not send ACP initialize request: {error}"))?;
        stdin
            .flush()
            .await
            .map_err(|error| format!("Could not flush ACP initialize request: {error}"))?;

        let mut line = String::new();
        let mut limited = BufReader::new(stdout).take(MAX_PROTOCOL_LINE_BYTES + 1);
        let read = limited
            .read_line(&mut line)
            .await
            .map_err(|error| format!("Could not read ACP initialize response: {error}"))?;
        if read == 0 {
            return Err("Agent closed before replying to ACP initialize.".to_string());
        }
        if read as u64 > MAX_PROTOCOL_LINE_BYTES {
            return Err("ACP initialize response exceeded the 1 MiB limit.".to_string());
        }
        serde_json::from_str::<JsonRpcResponse>(&line)
            .map_err(|error| format!("Agent returned an invalid ACP initialize response: {error}"))
    };

    let response = if let Some((epoch, expected_epoch)) = cancellation {
        tokio::select! {
            result = timeout(deadline, protocol) => timeout_result(result, deadline),
            () = wait_until_superseded(epoch, expected_epoch) => {
                Err("Agent discovery was superseded by a newer Workspace request.".into())
            }
        }
    } else {
        timeout_result(timeout(deadline, protocol).await, deadline)
    };
    drop(stdin);
    let cleanup = terminate_and_reap(&mut child, pid).await;
    let stderr = match timeout(STDERR_DRAIN_TIMEOUT, &mut stderr_task).await {
        Ok(result) => result.unwrap_or_default(),
        Err(_) => {
            stderr_task.abort();
            let _ = stderr_task.await;
            String::new()
        }
    };

    finalize_probe(response, cleanup, stderr)
}

fn finalize_probe(
    response: Result<JsonRpcResponse, String>,
    cleanup: Result<(), String>,
    stderr: String,
) -> ProbeResult {
    if let Err(cleanup_error) = cleanup {
        let protocol_context = response
            .err()
            .map(|message| format!(" {message}"))
            .unwrap_or_default();
        let stderr_context = if stderr.is_empty() {
            String::new()
        } else {
            format!(" Agent stderr: {stderr}")
        };
        return ProbeResult::failed(
            AgentStatus::HandshakeFailed,
            format!(
                "Agent cleanup could not be confirmed: {cleanup_error}.{protocol_context}{stderr_context}"
            ),
        );
    }

    match response {
        Ok(response) => classify_response(response),
        Err(message) => ProbeResult::failed(
            AgentStatus::HandshakeFailed,
            if stderr.is_empty() {
                message
            } else {
                format!("{message} Agent stderr: {stderr}")
            },
        ),
    }
}

fn timeout_result<T>(
    result: Result<Result<T, String>, tokio::time::error::Elapsed>,
    deadline: Duration,
) -> Result<T, String> {
    match result {
        Ok(result) => result,
        Err(_) => Err(format!(
            "ACP initialize timed out after {} ms.",
            deadline.as_millis()
        )),
    }
}

async fn wait_until_superseded(epoch: Arc<AtomicU64>, expected_epoch: u64) {
    loop {
        if epoch.load(Ordering::Acquire) != expected_epoch {
            return;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}

fn classify_response(response: JsonRpcResponse) -> ProbeResult {
    if response.jsonrpc != "2.0" || response.id != json!(1) {
        return ProbeResult::failed(
            AgentStatus::HandshakeFailed,
            "Agent returned an ACP initialize response for the wrong JSON-RPC request.",
        );
    }
    if let Some(error) = response.error {
        let status = if error.code == AUTH_REQUIRED_CODE {
            AgentStatus::AuthenticationRequired
        } else {
            AgentStatus::HandshakeFailed
        };
        return ProbeResult::failed(status, error.message);
    }

    let Some(response) = response.result else {
        return ProbeResult::failed(
            AgentStatus::HandshakeFailed,
            "ACP initialize response contained neither a result nor an error.",
        );
    };
    if response.protocol_version != ProtocolVersion::V1 {
        return ProbeResult {
            status: AgentStatus::Incompatible,
            message: format!(
                "Agent negotiated unsupported ACP protocol version {}.",
                response.protocol_version
            ),
            missing_capabilities: vec!["acp-v1".into()],
            agent_info: response.agent_info.map(agent_info),
            auth_methods: response.auth_methods.iter().map(auth_method_info).collect(),
        };
    }

    let agent_info = response.agent_info.map(agent_info);
    let auth_methods = response.auth_methods.iter().map(auth_method_info).collect();
    if !response.agent_capabilities.load_session {
        return ProbeResult {
            status: AgentStatus::Incompatible,
            message: "Agent does not advertise ACP session restoration.".into(),
            missing_capabilities: vec!["session-restore".into()],
            agent_info,
            auth_methods,
        };
    }

    ProbeResult {
        status: AgentStatus::Compatible,
        message: "ACP initialization and required capability negotiation succeeded.".into(),
        missing_capabilities: Vec::new(),
        agent_info,
        auth_methods,
    }
}

fn agent_info(info: agent_client_protocol::schema::v1::Implementation) -> AgentInfo {
    AgentInfo {
        name: info.title.unwrap_or(info.name),
        version: info.version,
    }
}

fn auth_method_info(method: &agent_client_protocol::schema::v1::AuthMethod) -> AuthMethodInfo {
    AuthMethodInfo {
        id: method.id().to_string(),
        name: method.name().to_string(),
        description: method.description().map(str::to_string),
    }
}

async fn terminate_and_reap(child: &mut Child, pid: Option<u32>) -> Result<(), String> {
    let mut failures = Vec::new();
    #[cfg(unix)]
    match pid
        .and_then(|pid| i32::try_from(pid).ok())
        .and_then(rustix::process::Pid::from_raw)
    {
        Some(pid) => {
            if let Err(error) =
                rustix::process::kill_process_group(pid, rustix::process::Signal::KILL)
            {
                if error != rustix::io::Errno::SRCH {
                    failures.push(format!("process-group termination failed: {error}"));
                }
            }
        }
        None => failures.push("process-group identity was unavailable".to_string()),
    }

    if let Err(error) = child.start_kill() {
        if error.kind() != std::io::ErrorKind::InvalidInput {
            failures.push(format!("direct child termination failed: {error}"));
        }
    }
    match timeout(CHILD_REAP_TIMEOUT, child.wait()).await {
        Ok(Ok(_)) => {}
        Ok(Err(error)) => failures.push(format!("child reap failed: {error}")),
        Err(_) => failures.push(format!(
            "child reap timed out after {} ms",
            CHILD_REAP_TIMEOUT.as_millis()
        )),
    }

    if failures.is_empty() {
        Ok(())
    } else {
        Err(failures.join("; "))
    }
}

#[cfg(test)]
mod cleanup_tests {
    use super::*;

    fn compatible_response() -> JsonRpcResponse {
        serde_json::from_value(json!({
            "jsonrpc": "2.0",
            "id": 1,
            "result": {
                "protocolVersion": 1,
                "agentCapabilities": { "loadSession": true }
            }
        }))
        .unwrap()
    }

    #[test]
    fn unconfirmed_cleanup_prevents_a_compatible_result() {
        for failure in [
            "process-group termination failed",
            "direct child termination failed",
            "child reap timed out",
        ] {
            let result = finalize_probe(
                Ok(compatible_response()),
                Err(failure.to_string()),
                String::new(),
            );

            assert_eq!(result.status, AgentStatus::HandshakeFailed);
            assert!(result.message.contains("cleanup could not be confirmed"));
            assert!(result.message.contains(failure));
        }
    }
}

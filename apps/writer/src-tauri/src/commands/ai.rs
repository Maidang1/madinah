use super::ai_content::{
    build_acp_action_prompt, normalize_acp_action_text, parse_ai_document_review,
    parse_ai_metadata_suggestion, DEFAULT_POLISH_INSTRUCTION,
};
#[cfg(test)]
use super::ai_content::{ACP_RESULT_END, ACP_RESULT_START};
use crate::error::AppError;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::Manager;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::time::{timeout, Duration};

const DEFAULT_PROVIDER: &str = "codex";
const DEFAULT_CODEX_COMMAND: &str = "npx -y @agentclientprotocol/codex-acp";
const DEFAULT_CLAUDE_COMMAND: &str = "npx -y @agentclientprotocol/claude-agent-acp";
const DEFAULT_TIMEOUT_SECONDS: u64 = 120;
const MIN_TIMEOUT_SECONDS: u64 = 10;
const MAX_TIMEOUT_SECONDS: u64 = 600;
const ACP_PROTOCOL_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiEnvVar {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiAgentSettings {
    pub command: String,
    pub env: Vec<AiEnvVar>,
    pub instruction: String,
    pub timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    pub schema_version: u8,
    pub provider: String,
    pub agents: HashMap<String, AiAgentSettings>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiActionInput {
    pub kind: String,
    pub content: String,
    pub workspace_root: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiActionResult {
    pub kind: String,
    pub content: String,
    pub provider: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<AiMetadataSuggestion>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub review: Option<AiDocumentReview>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiMetadataSuggestion {
    pub title: String,
    pub description: String,
    pub tags: Vec<String>,
    pub slug: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiDocumentReview {
    pub summary: String,
    pub issues: Vec<AiDocumentReviewIssue>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiDocumentReviewIssue {
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub suggestion: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiCheckResult {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq)]
struct AiRuntimeConfig {
    provider: String,
    command: String,
    env: Vec<AiEnvVar>,
    instruction: String,
    timeout_seconds: u64,
}

struct AcpProcess {
    child: Child,
    stdin: tokio::process::ChildStdin,
    stdout: tokio::io::Lines<BufReader<tokio::process::ChildStdout>>,
}

#[tauri::command]
pub fn load_ai_settings(app: tauri::AppHandle) -> Result<AiSettings, AppError> {
    read_ai_settings_from_path(ai_settings_path(&app)?)
}

#[tauri::command]
pub fn save_ai_settings(
    settings: AiSettings,
    app: tauri::AppHandle,
) -> Result<AiSettings, AppError> {
    save_ai_settings_to_path(ai_settings_path(&app)?, settings)
}

#[tauri::command]
pub async fn check_ai_settings(
    settings: AiSettings,
    app: tauri::AppHandle,
) -> Result<AiCheckResult, AppError> {
    let current = read_ai_settings_from_path(ai_settings_path(&app)?)
        .unwrap_or_else(|_| default_ai_settings());
    let normalized = normalize_ai_settings(merge_missing_agents(settings, &current));

    match selected_runtime_config(&normalized) {
        Ok(config) => match run_acp_initialize(&config, &workspace_dir(None)).await {
            Ok(()) => Ok(AiCheckResult {
                ok: true,
                message: "Connected".into(),
            }),
            Err(error) => Ok(AiCheckResult {
                ok: false,
                message: error.to_string(),
            }),
        },
        Err(error) => Ok(AiCheckResult {
            ok: false,
            message: error.to_string(),
        }),
    }
}

#[tauri::command]
pub async fn run_ai_action(
    input: AiActionInput,
    app: tauri::AppHandle,
) -> Result<AiActionResult, AppError> {
    let settings = read_ai_settings_from_path(ai_settings_path(&app)?)?;
    let config = selected_runtime_config(&settings)?;
    run_ai_action_with_config(input, config).await
}

pub fn default_ai_settings() -> AiSettings {
    let mut agents = HashMap::new();
    agents.insert(
        "codex".into(),
        AiAgentSettings {
            command: DEFAULT_CODEX_COMMAND.into(),
            env: Vec::new(),
            instruction: DEFAULT_POLISH_INSTRUCTION.into(),
            timeout_seconds: DEFAULT_TIMEOUT_SECONDS,
        },
    );
    agents.insert(
        "claude".into(),
        AiAgentSettings {
            command: DEFAULT_CLAUDE_COMMAND.into(),
            env: Vec::new(),
            instruction: DEFAULT_POLISH_INSTRUCTION.into(),
            timeout_seconds: DEFAULT_TIMEOUT_SECONDS,
        },
    );

    AiSettings {
        schema_version: 1,
        provider: DEFAULT_PROVIDER.into(),
        agents,
    }
}

fn ai_settings_path(app: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Io(error.to_string()))?
        .join("ai-settings.json"))
}

fn read_ai_settings_from_path(path: PathBuf) -> Result<AiSettings, AppError> {
    if !path.exists() {
        return Ok(default_ai_settings());
    }
    let raw = fs::read_to_string(path)?;
    let value: Value =
        serde_json::from_str(&raw).map_err(|error| AppError::Io(error.to_string()))?;
    Ok(normalize_ai_settings_from_value(&value))
}

fn save_ai_settings_to_path(path: PathBuf, settings: AiSettings) -> Result<AiSettings, AppError> {
    let current =
        read_ai_settings_from_path(path.clone()).unwrap_or_else(|_| default_ai_settings());
    let next = normalize_ai_settings(merge_missing_agents(settings, &current));
    validate_ai_settings(&next)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let raw =
        serde_json::to_string_pretty(&next).map_err(|error| AppError::Io(error.to_string()))?;
    fs::write(path, raw)?;
    Ok(next)
}

fn normalize_ai_settings_from_value(value: &Value) -> AiSettings {
    let fallback = default_ai_settings();
    let Some(object) = value.as_object() else {
        return fallback;
    };

    let provider = normalize_provider(object.get("provider").and_then(Value::as_str));
    let agents_value = object.get("agents").and_then(Value::as_object);
    let mut agents = HashMap::new();
    for (key, fallback_agent) in &fallback.agents {
        let value = agents_value.and_then(|agents| agents.get(key));
        agents.insert(key.clone(), normalize_agent_settings(value, fallback_agent));
    }

    AiSettings {
        schema_version: 1,
        provider,
        agents,
    }
}

fn normalize_ai_settings(settings: AiSettings) -> AiSettings {
    let fallback = default_ai_settings();
    let provider = normalize_provider(Some(&settings.provider));
    let mut agents = HashMap::new();

    for (key, fallback_agent) in &fallback.agents {
        let agent = settings.agents.get(key).unwrap_or(fallback_agent);
        agents.insert(
            key.clone(),
            normalize_agent_settings_struct(agent, fallback_agent),
        );
    }

    AiSettings {
        schema_version: 1,
        provider,
        agents,
    }
}

fn merge_missing_agents(mut settings: AiSettings, current: &AiSettings) -> AiSettings {
    for provider in ["codex", "claude"] {
        if !settings.agents.contains_key(provider) {
            if let Some(agent) = current.agents.get(provider) {
                settings.agents.insert(provider.into(), agent.clone());
            }
        }
    }
    settings
}

fn normalize_provider(value: Option<&str>) -> String {
    match value.map(str::trim) {
        Some("claude") => "claude".into(),
        _ => "codex".into(),
    }
}

fn normalize_agent_settings(value: Option<&Value>, fallback: &AiAgentSettings) -> AiAgentSettings {
    let Some(object) = value.and_then(Value::as_object) else {
        return fallback.clone();
    };

    let command = object
        .get("command")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&fallback.command)
        .to_string();
    let instruction = object
        .get("instruction")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&fallback.instruction)
        .to_string();
    let timeout_seconds = normalize_timeout_seconds(
        object.get("timeoutSeconds").and_then(|value| {
            value
                .as_u64()
                .or_else(|| value.as_f64().map(|n| n.round() as u64))
        }),
        fallback.timeout_seconds,
    );

    AiAgentSettings {
        command,
        env: normalize_env(object.get("env")),
        instruction,
        timeout_seconds,
    }
}

fn normalize_agent_settings_struct(
    settings: &AiAgentSettings,
    fallback: &AiAgentSettings,
) -> AiAgentSettings {
    AiAgentSettings {
        command: if settings.command.trim().is_empty() {
            fallback.command.clone()
        } else {
            settings.command.trim().to_string()
        },
        env: settings
            .env
            .iter()
            .filter_map(|item| normalize_env_var(&item.name, &item.value))
            .collect(),
        instruction: if settings.instruction.trim().is_empty() {
            fallback.instruction.clone()
        } else {
            settings.instruction.trim().to_string()
        },
        timeout_seconds: normalize_timeout_seconds(
            Some(settings.timeout_seconds),
            fallback.timeout_seconds,
        ),
    }
}

fn normalize_env(value: Option<&Value>) -> Vec<AiEnvVar> {
    let Some(items) = value.and_then(Value::as_array) else {
        return Vec::new();
    };

    items
        .iter()
        .filter_map(|item| {
            let object = item.as_object()?;
            normalize_env_var(
                object.get("name").and_then(Value::as_str).unwrap_or(""),
                object
                    .get("value")
                    .and_then(Value::as_str)
                    .unwrap_or_default(),
            )
        })
        .collect()
}

fn normalize_env_var(name: &str, value: &str) -> Option<AiEnvVar> {
    let name = name.trim();
    if !is_valid_env_name(name) {
        return None;
    }
    Some(AiEnvVar {
        name: name.into(),
        value: value.into(),
    })
}

fn normalize_timeout_seconds(value: Option<u64>, fallback: u64) -> u64 {
    value
        .unwrap_or(fallback)
        .clamp(MIN_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS)
}

fn validate_ai_settings(settings: &AiSettings) -> Result<(), AppError> {
    selected_runtime_config(settings)?;
    Ok(())
}

fn selected_runtime_config(settings: &AiSettings) -> Result<AiRuntimeConfig, AppError> {
    let provider = normalize_provider(Some(&settings.provider));
    let agent = settings
        .agents
        .get(&provider)
        .ok_or_else(|| AppError::Invalid(format!("Missing AI agent settings for {provider}")))?;
    let agent = normalize_agent_settings_struct(
        agent,
        default_ai_settings()
            .agents
            .get(&provider)
            .expect("default provider exists"),
    );
    if agent.command.trim().is_empty() {
        return Err(AppError::Invalid("AI command is empty".into()));
    }
    for item in &agent.env {
        if !is_valid_env_name(&item.name) {
            return Err(AppError::Invalid(format!(
                "Invalid environment variable: {}",
                item.name
            )));
        }
    }

    Ok(AiRuntimeConfig {
        provider,
        command: agent.command,
        env: agent.env,
        instruction: agent.instruction,
        timeout_seconds: agent.timeout_seconds,
    })
}

async fn run_ai_action_with_config(
    input: AiActionInput,
    config: AiRuntimeConfig,
) -> Result<AiActionResult, AppError> {
    let kind = normalize_ai_action_kind(&input.kind)?;
    if input.content.trim().is_empty() {
        return Err(AppError::Invalid("AI content is empty".into()));
    }

    let prompt = build_acp_action_prompt(&kind, &input.content, &config.instruction);
    let cwd = workspace_dir(input.workspace_root.as_deref());
    let raw = run_acp_text_action(&config, &cwd, &prompt).await?;
    let content = normalize_acp_action_text(&raw);
    if content.is_empty() {
        return Err(AppError::Invalid("AI agent returned empty content".into()));
    }

    let metadata = if kind == "generate-metadata" {
        Some(parse_ai_metadata_suggestion(&content)?)
    } else {
        None
    };
    let review = if kind == "review-document" {
        Some(parse_ai_document_review(&content)?)
    } else {
        None
    };

    Ok(AiActionResult {
        kind,
        content,
        provider: config.provider,
        metadata,
        review,
    })
}

fn normalize_ai_action_kind(kind: &str) -> Result<String, AppError> {
    match kind {
        "polish-document" | "rewrite-selection" | "generate-metadata" | "review-document" => {
            Ok(kind.into())
        }
        _ => Err(AppError::Invalid(format!("Unsupported AI action: {kind}"))),
    }
}

async fn run_acp_initialize(config: &AiRuntimeConfig, cwd: &Path) -> Result<(), AppError> {
    let mut process = spawn_acp_agent(config, cwd)?;
    let result = run_with_timeout(
        async {
            send_request(
                &mut process,
                1,
                "initialize",
                json!({
                    "protocolVersion": ACP_PROTOCOL_VERSION,
                    "clientInfo": {
                        "name": "madinah-writer",
                        "version": "0.1.0"
                    }
                }),
            )
            .await
            .map(|_| ())
        },
        config.timeout_seconds,
        "AI agent timed out",
    )
    .await;
    let _ = process.child.kill().await;
    result
}

async fn run_acp_text_action(
    config: &AiRuntimeConfig,
    cwd: &Path,
    prompt: &str,
) -> Result<String, AppError> {
    let mut process = spawn_acp_agent(config, cwd)?;
    let result = run_with_timeout(
        async {
            send_request(
                &mut process,
                1,
                "initialize",
                json!({
                    "protocolVersion": ACP_PROTOCOL_VERSION,
                    "clientInfo": {
                        "name": "madinah-writer",
                        "version": "0.1.0"
                    }
                }),
            )
            .await?;

            let session = send_request(
                &mut process,
                2,
                "session/new",
                json!({
                    "cwd": cwd.to_string_lossy(),
                    "mcpServers": []
                }),
            )
            .await?;
            let session_id = session
                .get("sessionId")
                .and_then(Value::as_str)
                .ok_or_else(|| AppError::Invalid("AI agent did not return a session id".into()))?
                .to_string();

            send_request_collecting_updates(
                &mut process,
                3,
                "session/prompt",
                json!({
                    "sessionId": session_id,
                    "prompt": [
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }),
                &session_id,
            )
            .await
        },
        config.timeout_seconds,
        "AI agent timed out",
    )
    .await;

    let _ = process.child.kill().await;
    result
}

async fn send_request(
    process: &mut AcpProcess,
    id: u64,
    method: &str,
    params: Value,
) -> Result<Value, AppError> {
    send_json_line(
        process,
        json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        }),
    )
    .await?;

    loop {
        let message = read_json_line(process).await?;
        if is_request_permission_request(&message) {
            respond_permission_cancelled(process, &message).await?;
            continue;
        }
        if is_session_update(&message) {
            continue;
        }
        if message.get("id").and_then(Value::as_u64) == Some(id) {
            return parse_rpc_response(message);
        }
    }
}

async fn send_request_collecting_updates(
    process: &mut AcpProcess,
    id: u64,
    method: &str,
    params: Value,
    session_id: &str,
) -> Result<String, AppError> {
    send_json_line(
        process,
        json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        }),
    )
    .await?;

    let mut output = String::new();
    loop {
        let message = read_json_line(process).await?;
        if is_request_permission_request(&message) {
            respond_permission_cancelled(process, &message).await?;
            continue;
        }
        if let Some(chunk) = text_chunk_from_session_update(&message, session_id) {
            output.push_str(&chunk);
            continue;
        }
        if message.get("id").and_then(Value::as_u64) == Some(id) {
            parse_rpc_response(message)?;
            return Ok(output);
        }
    }
}

async fn send_json_line(process: &mut AcpProcess, value: Value) -> Result<(), AppError> {
    let mut raw = serde_json::to_vec(&value).map_err(|error| AppError::Io(error.to_string()))?;
    raw.push(b'\n');
    process.stdin.write_all(&raw).await?;
    process.stdin.flush().await?;
    Ok(())
}

async fn read_json_line(process: &mut AcpProcess) -> Result<Value, AppError> {
    let Some(line) = process.stdout.next_line().await? else {
        return Err(AppError::Invalid("AI agent closed the ACP stream".into()));
    };
    serde_json::from_str(&line).map_err(|error| AppError::Invalid(error.to_string()))
}

fn parse_rpc_response(message: Value) -> Result<Value, AppError> {
    if let Some(error) = message.get("error") {
        let message = error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("AI agent returned an error");
        return Err(AppError::Invalid(message.into()));
    }
    Ok(message.get("result").cloned().unwrap_or(Value::Null))
}

fn is_session_update(message: &Value) -> bool {
    message.get("method").and_then(Value::as_str) == Some("session/update")
}

fn is_request_permission_request(message: &Value) -> bool {
    message.get("method").and_then(Value::as_str) == Some("session/request_permission")
        && message.get("id").is_some()
}

async fn respond_permission_cancelled(
    process: &mut AcpProcess,
    message: &Value,
) -> Result<(), AppError> {
    let id = message.get("id").cloned().unwrap_or(Value::Null);
    send_json_line(
        process,
        json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "outcome": {
                    "outcome": "cancelled"
                }
            }
        }),
    )
    .await
}

fn text_chunk_from_session_update(message: &Value, session_id: &str) -> Option<String> {
    if message.get("method").and_then(Value::as_str) != Some("session/update") {
        return None;
    }
    let params = message.get("params")?;
    if params.get("sessionId").and_then(Value::as_str) != Some(session_id) {
        return None;
    }
    let update = params.get("update")?;
    if update.get("sessionUpdate").and_then(Value::as_str) != Some("agent_message_chunk") {
        return None;
    }
    let content = update.get("content")?;
    if content.get("type").and_then(Value::as_str) != Some("text") {
        return None;
    }
    content
        .get("text")
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn spawn_acp_agent(config: &AiRuntimeConfig, cwd: &Path) -> Result<AcpProcess, AppError> {
    let command_parts = parse_command_parts(&config.command)?;
    let (program, args) = command_parts
        .split_first()
        .ok_or_else(|| AppError::Invalid("AI command is empty".into()))?;

    let mut command = Command::new(program);
    command
        .args(args)
        .current_dir(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit());
    for item in &config.env {
        command.env(&item.name, &item.value);
    }

    let mut child = command.spawn()?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| AppError::Io("Failed to open AI agent stdin".into()))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::Io("Failed to open AI agent stdout".into()))?;

    Ok(AcpProcess {
        child,
        stdin,
        stdout: BufReader::new(stdout).lines(),
    })
}

async fn run_with_timeout<F, T>(future: F, seconds: u64, message: &str) -> Result<T, AppError>
where
    F: std::future::Future<Output = Result<T, AppError>>,
{
    timeout(Duration::from_secs(seconds), future)
        .await
        .map_err(|_| AppError::Invalid(format!("{message} after {seconds}s")))?
}

fn workspace_dir(workspace_root: Option<&str>) -> PathBuf {
    workspace_root
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

fn parse_command_parts(command: &str) -> Result<Vec<String>, AppError> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut chars = command.trim().chars().peekable();
    let mut quote: Option<char> = None;
    let mut escaped = false;

    while let Some(ch) = chars.next() {
        if escaped {
            current.push(ch);
            escaped = false;
            continue;
        }
        if ch == '\\' {
            escaped = true;
            continue;
        }
        if let Some(quote_char) = quote {
            if ch == quote_char {
                quote = None;
            } else {
                current.push(ch);
            }
            continue;
        }
        if ch == '"' || ch == '\'' {
            quote = Some(ch);
            continue;
        }
        if ch.is_whitespace() {
            if !current.is_empty() {
                parts.push(std::mem::take(&mut current));
            }
            while chars.peek().is_some_and(|next| next.is_whitespace()) {
                chars.next();
            }
            continue;
        }
        current.push(ch);
    }

    if escaped || quote.is_some() {
        return Err(AppError::Invalid(
            "Failed to parse AI command: unsupported shell syntax".into(),
        ));
    }
    if !current.is_empty() {
        parts.push(current);
    }
    if parts.is_empty() {
        return Err(AppError::Invalid("AI command is empty".into()));
    }
    Ok(parts)
}

fn is_valid_env_name(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !(first == '_' || first.is_ascii_alphabetic()) {
        return false;
    }
    chars.all(|ch| ch == '_' || ch.is_ascii_alphanumeric())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_settings_use_acp_agent_defaults() {
        let settings = default_ai_settings();
        assert_eq!(settings.schema_version, 1);
        assert_eq!(settings.provider, "codex");
        assert_eq!(
            settings.agents["codex"].command,
            "npx -y @agentclientprotocol/codex-acp"
        );
        assert_eq!(
            settings.agents["claude"].command,
            "npx -y @agentclientprotocol/claude-agent-acp"
        );
    }

    #[test]
    fn normalizes_settings_and_env() {
        let value = json!({
            "provider": "claude",
            "agents": {
                "codex": {
                    "command": "  custom codex  ",
                    "env": [
                        { "name": "OPENAI_API_KEY", "value": "secret" },
                        { "name": "1_BAD", "value": "no" }
                    ],
                    "instruction": "  tighten prose ",
                    "timeoutSeconds": 999
                }
            }
        });

        let settings = normalize_ai_settings_from_value(&value);
        assert_eq!(settings.provider, "claude");
        assert_eq!(settings.agents["codex"].command, "custom codex");
        assert_eq!(settings.agents["codex"].instruction, "tighten prose");
        assert_eq!(settings.agents["codex"].timeout_seconds, 600);
        assert_eq!(
            settings.agents["codex"].env,
            vec![AiEnvVar {
                name: "OPENAI_API_KEY".into(),
                value: "secret".into(),
            }]
        );
        assert_eq!(
            settings.agents["claude"].command,
            "npx -y @agentclientprotocol/claude-agent-acp"
        );
    }

    #[test]
    fn builds_prompts_with_result_envelope() {
        let prompt = build_acp_action_prompt("rewrite-selection", "**hello**", "make it warmer");
        assert!(prompt.contains("Selected Markdown:"));
        assert!(prompt.contains(ACP_RESULT_START));
        assert!(prompt.contains(ACP_RESULT_END));
        assert!(prompt.contains("make it warmer"));
    }

    #[test]
    fn builds_metadata_and_review_prompts() {
        let metadata_prompt =
            build_acp_action_prompt("generate-metadata", "# Draft", DEFAULT_POLISH_INSTRUCTION);
        assert!(metadata_prompt.contains("\"title\": \"string\""));
        assert!(metadata_prompt.contains("Return only valid JSON"));
        assert!(!metadata_prompt.contains("Additional writing instruction"));

        let review_prompt = build_acp_action_prompt("review-document", "# Draft", "focus on flow");
        assert!(review_prompt.contains("\"severity\": \"info | warning | critical\""));
        assert!(review_prompt.contains("focus on flow"));
    }

    #[test]
    fn normalizes_enveloped_fenced_output() {
        let raw = format!(
            "log\n{ACP_RESULT_START}\n```markdown\n# Polished\n```\n{ACP_RESULT_END}\nmore"
        );
        assert_eq!(normalize_acp_action_text(&raw), "# Polished");
    }

    #[test]
    fn parses_metadata_json() {
        let raw = r#"{
          "title": "Madinah AI",
          "description": "A concise description.",
          "tags": ["AI", "writer", "AI"],
          "slug": "Madinah AI"
        }"#;
        assert_eq!(
            parse_ai_metadata_suggestion(raw).unwrap(),
            AiMetadataSuggestion {
                title: "Madinah AI".into(),
                description: "A concise description.".into(),
                tags: vec!["ai".into(), "writer".into()],
                slug: "madinah-ai".into(),
            }
        );
    }

    #[test]
    fn parses_review_json_with_safe_severities() {
        let raw = r#"{
          "summary": "Clear structure with one weak opening.",
          "issues": [
            {
              "severity": "warning",
              "title": "Weak opening",
              "detail": "The first paragraph is vague.",
              "suggestion": "Start with the concrete claim."
            },
            {
              "severity": "unknown",
              "title": "",
              "detail": "Needs a source.",
              "suggestion": ""
            }
          ]
        }"#;
        let review = parse_ai_document_review(raw).unwrap();
        assert_eq!(review.summary, "Clear structure with one weak opening.");
        assert_eq!(review.issues.len(), 2);
        assert_eq!(review.issues[0].severity, "warning");
        assert_eq!(review.issues[1].severity, "info");
        assert_eq!(review.issues[1].title, "Writing issue");
    }

    #[test]
    fn extracts_last_result_envelope() {
        let raw = format!(
            "{ACP_RESULT_START}\nfirst\n{ACP_RESULT_END}\n{ACP_RESULT_START}\nsecond\n{ACP_RESULT_END}"
        );
        assert_eq!(normalize_acp_action_text(&raw), "second");
    }

    #[test]
    fn parses_quoted_command_parts() {
        assert_eq!(
            parse_command_parts("env FOO=bar \"agent path\" --flag").unwrap(),
            vec!["env", "FOO=bar", "agent path", "--flag"]
        );
        assert!(parse_command_parts("\"unterminated").is_err());
    }

    #[test]
    fn extracts_acp_text_chunks() {
        let message = json!({
            "jsonrpc": "2.0",
            "method": "session/update",
            "params": {
                "sessionId": "s1",
                "update": {
                    "sessionUpdate": "agent_message_chunk",
                    "content": {
                        "type": "text",
                        "text": "hello"
                    }
                }
            }
        });
        assert_eq!(
            text_chunk_from_session_update(&message, "s1"),
            Some("hello".into())
        );
        assert_eq!(text_chunk_from_session_update(&message, "s2"), None);
    }
}

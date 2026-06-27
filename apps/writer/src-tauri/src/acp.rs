use crate::{
    errors::AppResult,
    models::{
        AcpAgentCheckResult, AcpAgentRuntimeConfig, AcpEnvVar, AcpPolishInput, AcpPolishResult,
    },
};
use agent_client_protocol::{
    schema::{
        v1::{
            InitializeRequest, RequestPermissionOutcome, RequestPermissionRequest,
            RequestPermissionResponse,
        },
        ProtocolVersion,
    },
    AcpAgent, Agent, Client, ConnectionTo,
};
use std::path::PathBuf;
use std::time::Duration;

const DEFAULT_TIMEOUT_SECONDS: u64 = 120;

pub async fn polish_text(input: AcpPolishInput) -> AppResult<AcpPolishResult> {
    let provider = input.provider.clone();
    let timeout_seconds = normalize_timeout(input.timeout_seconds);

    let content = tokio::time::timeout(Duration::from_secs(timeout_seconds), run_polish(input))
        .await
        .map_err(|_| format!("ACP agent timed out after {timeout_seconds}s"))??;

    Ok(AcpPolishResult { content, provider })
}

pub async fn check_agent(input: AcpAgentRuntimeConfig) -> AppResult<AcpAgentCheckResult> {
    let timeout_seconds = normalize_timeout(input.timeout_seconds);

    tokio::time::timeout(Duration::from_secs(timeout_seconds), run_check(input))
        .await
        .map_err(|_| format!("ACP agent timed out after {timeout_seconds}s"))?
}

async fn run_polish(input: AcpPolishInput) -> AppResult<String> {
    let agent = create_agent(&input.command, &input.env)?;
    let prompt = build_polish_prompt(&input.content, &input.instruction);
    let cwd = workspace_dir(input.workspace_root.as_deref())?;

    let output = Client
        .builder()
        .name("madinah-writer")
        .on_receive_request(
            cancel_permission_request,
            agent_client_protocol::on_receive_request!(),
        )
        .connect_with(agent, |connection: ConnectionTo<Agent>| async move {
            connection
                .send_request(InitializeRequest::new(ProtocolVersion::V1))
                .block_task()
                .await?;

            let mut session = connection
                .build_session(cwd)
                .block_task()
                .start_session()
                .await?;
            session.send_prompt(prompt)?;
            session.read_to_string().await
        })
        .await
        .map_err(format_acp_error)?;

    let trimmed = output.trim();
    if trimmed.is_empty() {
        return Err("ACP agent returned empty content".to_string());
    }

    Ok(trimmed.to_string())
}

async fn run_check(input: AcpAgentRuntimeConfig) -> AppResult<AcpAgentCheckResult> {
    let agent = create_agent(&input.command, &input.env)?;

    Client
        .builder()
        .name("madinah-writer")
        .on_receive_request(
            cancel_permission_request,
            agent_client_protocol::on_receive_request!(),
        )
        .connect_with(agent, |connection: ConnectionTo<Agent>| async move {
            connection
                .send_request(InitializeRequest::new(ProtocolVersion::V1))
                .block_task()
                .await?;

            Ok::<_, agent_client_protocol::Error>(())
        })
        .await
        .map_err(format_acp_error)?;

    Ok(AcpAgentCheckResult {
        ok: true,
        agent_name: None,
        message: "Connected".to_string(),
    })
}

async fn cancel_permission_request(
    _request: RequestPermissionRequest,
    responder: agent_client_protocol::Responder<RequestPermissionResponse>,
    _connection: ConnectionTo<Agent>,
) -> Result<(), agent_client_protocol::Error> {
    responder.respond(RequestPermissionResponse::new(
        RequestPermissionOutcome::Cancelled,
    ))
}

fn create_agent(command: &str, env: &[AcpEnvVar]) -> AppResult<AcpAgent> {
    AcpAgent::from_args(build_agent_args(command, env)?).map_err(format_acp_error)
}

pub fn build_agent_args(command: &str, env: &[AcpEnvVar]) -> AppResult<Vec<String>> {
    let command = command.trim();
    if command.is_empty() {
        return Err("ACP command is empty".to_string());
    }

    let mut args = Vec::new();
    for item in env {
        let name = item.name.trim();
        if !is_valid_env_name(name) {
            return Err(format!("Invalid environment variable: {name}"));
        }
        args.push(format!("{name}={}", item.value));
    }

    let command_parts = shell_words::split(command)
        .map_err(|error| format!("Failed to parse ACP command: {error}"))?;
    if command_parts.is_empty() {
        return Err("ACP command is empty".to_string());
    }

    args.extend(command_parts);
    Ok(args)
}

pub fn build_polish_prompt(content: &str, instruction: &str) -> String {
    let instruction = instruction.trim();
    let instruction = if instruction.is_empty() {
        "Polish the Markdown body for clarity, fluency, and natural expression."
    } else {
        instruction
    };

    format!(
        "{instruction}\n\nRules:\n- Return only the polished Markdown body.\n- Preserve Markdown structure, links, code fences, MDX/JSX components, and factual meaning.\n- Keep frontmatter out of the output.\n\nMarkdown body:\n<<<MADINAH_WRITER_BODY\n{content}\nMADINAH_WRITER_BODY"
    )
}

fn workspace_dir(workspace_root: Option<&str>) -> AppResult<PathBuf> {
    if let Some(root) = workspace_root {
        let trimmed = root.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }

    std::env::current_dir().map_err(|error| error.to_string())
}

fn normalize_timeout(value: u64) -> u64 {
    if value == 0 {
        DEFAULT_TIMEOUT_SECONDS
    } else {
        value.clamp(10, 600)
    }
}

fn is_valid_env_name(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if !first.is_ascii_alphabetic() && first != '_' {
        return false;
    }
    chars.all(|item| item.is_ascii_alphanumeric() || item == '_')
}

fn format_acp_error(error: agent_client_protocol::Error) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_agent_args_prefixes_env_and_splits_command() {
        let args = build_agent_args(
            r#"npx -y "@agentclientprotocol/codex-acp""#,
            &[AcpEnvVar {
                name: "CODEX_PATH".to_string(),
                value: "/usr/local/bin/codex".to_string(),
            }],
        )
        .expect("args");

        assert_eq!(
            args,
            vec![
                "CODEX_PATH=/usr/local/bin/codex",
                "npx",
                "-y",
                "@agentclientprotocol/codex-acp"
            ]
        );
    }

    #[test]
    fn build_agent_args_rejects_invalid_env() {
        let error = build_agent_args(
            "npx -y @agentclientprotocol/codex-acp",
            &[AcpEnvVar {
                name: "1_BAD".to_string(),
                value: "x".to_string(),
            }],
        )
        .expect_err("invalid env");

        assert!(error.contains("Invalid environment variable"));
    }

    #[test]
    fn build_polish_prompt_wraps_body_and_rules() {
        let prompt = build_polish_prompt("# Title\n\nBody", "Make it clear.");

        assert!(prompt.contains("Make it clear."));
        assert!(prompt.contains("Return only the polished Markdown body."));
        assert!(prompt.contains("<<<MADINAH_WRITER_BODY\n# Title\n\nBody\nMADINAH_WRITER_BODY"));
    }

    #[test]
    fn normalize_timeout_clamps_supported_range() {
        assert_eq!(normalize_timeout(0), 120);
        assert_eq!(normalize_timeout(120), 120);
        assert_eq!(normalize_timeout(900), 600);
    }
}

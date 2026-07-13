use super::ai_content::{
    build_ai_action_prompt, normalize_ai_action_text, parse_ai_document_review,
    parse_ai_metadata_suggestion, AiActionKind, DEFAULT_POLISH_INSTRUCTION,
};
use crate::error::AppError;
use codex::{
    ApprovalMode, Codex, CodexOptions, SandboxMode, ThreadOptions, TurnOptions, WebSearchMode,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tokio::time::{timeout, Duration};

const AI_SETTINGS_SCHEMA_VERSION: u8 = 2;
const DEFAULT_TIMEOUT_SECONDS: u64 = 120;
const MIN_TIMEOUT_SECONDS: u64 = 10;
const MAX_TIMEOUT_SECONDS: u64 = 600;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    pub schema_version: u8,
    pub codex_path: String,
    pub model: String,
    pub instruction: String,
    pub timeout_seconds: u64,
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

#[derive(Debug, Clone, PartialEq, Eq)]
struct AiRuntimeConfig {
    codex_path: Option<String>,
    model: Option<String>,
    instruction: String,
    timeout_seconds: u64,
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
pub fn check_ai_settings(settings: AiSettings) -> AiCheckResult {
    let settings = normalize_ai_settings(settings);
    match runtime_config(&settings).and_then(|config| build_codex_client(&config)) {
        Ok(_) => AiCheckResult {
            ok: true,
            message: "Codex SDK is ready".into(),
        },
        Err(error) => AiCheckResult {
            ok: false,
            message: error.to_string(),
        },
    }
}

#[tauri::command]
pub async fn run_ai_action(
    input: AiActionInput,
    app: tauri::AppHandle,
) -> Result<AiActionResult, AppError> {
    let settings = read_ai_settings_from_path(ai_settings_path(&app)?)?;
    let config = runtime_config(&settings)?;
    run_ai_action_with_config(input, config).await
}

pub fn default_ai_settings() -> AiSettings {
    AiSettings {
        schema_version: AI_SETTINGS_SCHEMA_VERSION,
        codex_path: String::new(),
        model: String::new(),
        instruction: DEFAULT_POLISH_INSTRUCTION.into(),
        timeout_seconds: DEFAULT_TIMEOUT_SECONDS,
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
    let next = normalize_ai_settings(settings);
    runtime_config(&next)?;

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
    let codex_path = trimmed_string(value.get("codexPath")).unwrap_or_default();
    let model = trimmed_string(value.get("model")).unwrap_or_default();
    let instruction = trimmed_string(value.get("instruction"))
        .or_else(|| trimmed_string(value.pointer("/agents/codex/instruction")))
        .unwrap_or_else(|| fallback.instruction.clone());
    let timeout_seconds = numeric_u64(value.get("timeoutSeconds"))
        .or_else(|| numeric_u64(value.pointer("/agents/codex/timeoutSeconds")))
        .unwrap_or(fallback.timeout_seconds)
        .clamp(MIN_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS);

    AiSettings {
        schema_version: AI_SETTINGS_SCHEMA_VERSION,
        codex_path,
        model,
        instruction,
        timeout_seconds,
    }
}

fn normalize_ai_settings(settings: AiSettings) -> AiSettings {
    let fallback = default_ai_settings();
    AiSettings {
        schema_version: AI_SETTINGS_SCHEMA_VERSION,
        codex_path: settings.codex_path.trim().to_string(),
        model: settings.model.trim().to_string(),
        instruction: if settings.instruction.trim().is_empty() {
            fallback.instruction
        } else {
            settings.instruction.trim().to_string()
        },
        timeout_seconds: settings
            .timeout_seconds
            .clamp(MIN_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS),
    }
}

fn trimmed_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn numeric_u64(value: Option<&Value>) -> Option<u64> {
    value.and_then(|value| {
        value.as_u64().or_else(|| {
            value
                .as_f64()
                .filter(|number| number.is_finite() && *number >= 0.0)
                .map(|number| number.round() as u64)
        })
    })
}

fn runtime_config(settings: &AiSettings) -> Result<AiRuntimeConfig, AppError> {
    let normalized = normalize_ai_settings(settings.clone());
    if normalized.instruction.trim().is_empty() {
        return Err(AppError::Invalid("AI instruction is empty".into()));
    }
    Ok(AiRuntimeConfig {
        codex_path: optional_setting(&normalized.codex_path),
        model: optional_setting(&normalized.model),
        instruction: normalized.instruction,
        timeout_seconds: normalized.timeout_seconds,
    })
}

fn optional_setting(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn build_codex_client(config: &AiRuntimeConfig) -> Result<Codex, AppError> {
    Codex::new(Some(CodexOptions {
        codex_path_override: config.codex_path.clone(),
        ..Default::default()
    }))
    .map_err(codex_error)
}

fn codex_error(error: codex::Error) -> AppError {
    AppError::Invalid(error.to_string())
}

async fn run_ai_action_with_config(
    input: AiActionInput,
    config: AiRuntimeConfig,
) -> Result<AiActionResult, AppError> {
    let kind = AiActionKind::parse(&input.kind)
        .ok_or_else(|| AppError::Invalid(format!("Unsupported AI action: {}", input.kind)))?;
    if input.content.trim().is_empty() {
        return Err(AppError::Invalid("AI content is empty".into()));
    }

    let prompt = build_ai_action_prompt(kind, &input.content, &config.instruction);
    let cwd = workspace_dir(input.workspace_root.as_deref());
    let raw = run_codex_turn(&config, &cwd, kind, &prompt).await?;
    let content = normalize_ai_action_text(&raw);
    if content.is_empty() {
        return Err(AppError::Invalid("Codex returned empty content".into()));
    }

    let metadata = if kind == AiActionKind::GenerateMetadata {
        Some(parse_ai_metadata_suggestion(&content)?)
    } else {
        None
    };
    let review = if kind == AiActionKind::ReviewDocument {
        Some(parse_ai_document_review(&content)?)
    } else {
        None
    };

    Ok(AiActionResult {
        kind: kind.as_str().into(),
        content,
        provider: "codex".into(),
        metadata,
        review,
    })
}

async fn run_codex_turn(
    config: &AiRuntimeConfig,
    cwd: &Path,
    kind: AiActionKind,
    prompt: &str,
) -> Result<String, AppError> {
    let codex = build_codex_client(config)?;
    let thread = codex.start_thread(Some(ThreadOptions {
        model: config.model.clone(),
        sandbox_mode: Some(SandboxMode::ReadOnly),
        working_directory: Some(cwd.to_string_lossy().into_owned()),
        skip_git_repo_check: Some(true),
        network_access_enabled: Some(false),
        web_search_mode: Some(WebSearchMode::Disabled),
        approval_policy: Some(ApprovalMode::Never),
        ..Default::default()
    }));
    let turn_options = output_schema_for_kind(kind).map(|output_schema| TurnOptions {
        output_schema: Some(output_schema),
        ..Default::default()
    });

    let turn = timeout(
        Duration::from_secs(config.timeout_seconds),
        thread.run(prompt.to_string(), turn_options),
    )
    .await
    .map_err(|_| AppError::Invalid(format!("Codex timed out after {}s", config.timeout_seconds)))?
    .map_err(codex_error)?;
    Ok(turn.final_response)
}

fn output_schema_for_kind(kind: AiActionKind) -> Option<Value> {
    match kind {
        AiActionKind::GenerateMetadata => Some(json!({
            "type": "object",
            "properties": {
                "title": { "type": "string" },
                "description": { "type": "string" },
                "tags": {
                    "type": "array",
                    "items": { "type": "string" }
                },
                "slug": { "type": "string" }
            },
            "required": ["title", "description", "tags", "slug"],
            "additionalProperties": false
        })),
        AiActionKind::ReviewDocument => Some(json!({
            "type": "object",
            "properties": {
                "summary": { "type": "string" },
                "issues": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "severity": {
                                "type": "string",
                                "enum": ["info", "warning", "critical"]
                            },
                            "title": { "type": "string" },
                            "detail": { "type": "string" },
                            "suggestion": { "type": "string" }
                        },
                        "required": ["severity", "title", "detail", "suggestion"],
                        "additionalProperties": false
                    }
                }
            },
            "required": ["summary", "issues"],
            "additionalProperties": false
        })),
        _ => None,
    }
}

fn workspace_dir(workspace_root: Option<&str>) -> PathBuf {
    workspace_root
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_settings_use_codex_sdk_defaults() {
        let settings = default_ai_settings();
        assert_eq!(settings.schema_version, 2);
        assert_eq!(settings.codex_path, "");
        assert_eq!(settings.model, "");
        assert_eq!(settings.timeout_seconds, 120);
    }

    #[test]
    fn migrates_legacy_codex_settings_and_drops_acp_fields() {
        let value = json!({
            "schemaVersion": 1,
            "provider": "claude",
            "agents": {
                "codex": {
                    "command": "legacy-command",
                    "env": [{ "name": "OPENAI_API_KEY", "value": "secret" }],
                    "instruction": "  tighten prose ",
                    "timeoutSeconds": 999
                },
                "claude": {
                    "instruction": "ignore this"
                }
            }
        });

        assert_eq!(
            normalize_ai_settings_from_value(&value),
            AiSettings {
                schema_version: 2,
                codex_path: String::new(),
                model: String::new(),
                instruction: "tighten prose".into(),
                timeout_seconds: 600,
            }
        );
    }

    #[test]
    fn normalizes_sdk_settings() {
        let settings = normalize_ai_settings(AiSettings {
            schema_version: 9,
            codex_path: "  /opt/homebrew/bin/codex  ".into(),
            model: "  gpt-5.4  ".into(),
            instruction: "  ".into(),
            timeout_seconds: 1,
        });
        assert_eq!(settings.schema_version, 2);
        assert_eq!(settings.codex_path, "/opt/homebrew/bin/codex");
        assert_eq!(settings.model, "gpt-5.4");
        assert_eq!(settings.instruction, DEFAULT_POLISH_INSTRUCTION);
        assert_eq!(settings.timeout_seconds, 10);
    }

    #[test]
    fn builds_prompts_without_acp_envelopes() {
        let prompt = build_ai_action_prompt(
            AiActionKind::RewriteSelection,
            "**hello**",
            "make it warmer",
        );
        assert!(prompt.contains("Selected Markdown:"));
        assert!(prompt.contains("make it warmer"));
        assert!(!prompt.contains("MADINAH_WRITER_RESULT"));
    }

    #[test]
    fn builds_metadata_and_review_prompts() {
        let metadata_prompt = build_ai_action_prompt(
            AiActionKind::GenerateMetadata,
            "# Draft",
            DEFAULT_POLISH_INSTRUCTION,
        );
        assert!(metadata_prompt.contains("\"title\": \"string\""));
        assert!(metadata_prompt.contains("Return only valid JSON"));
        assert!(!metadata_prompt.contains("Additional writing instruction"));

        let review_prompt =
            build_ai_action_prompt(AiActionKind::ReviewDocument, "# Draft", "focus on flow");
        assert!(review_prompt.contains("\"severity\": \"info | warning | critical\""));
        assert!(review_prompt.contains("focus on flow"));
    }

    #[test]
    fn parses_and_builds_new_writing_actions() {
        let cases = [
            ("shorten-selection", "30 to 50 percent"),
            ("expand-selection", "Do not invent names"),
            ("translate-selection", "Simplified Chinese"),
            ("continue-writing", "exact cursor marker"),
            ("generate-outline", "nested Markdown bullet lists"),
        ];

        for (value, expected_prompt) in cases {
            let kind = AiActionKind::parse(value).expect("registered AI action");
            assert_eq!(kind.as_str(), value);
            let prompt = build_ai_action_prompt(kind, "Draft", DEFAULT_POLISH_INSTRUCTION);
            assert!(prompt.contains(expected_prompt), "prompt for {value}");
            assert!(!prompt.contains("Additional writing instruction"));
        }
        assert!(AiActionKind::parse("unknown-action").is_none());
    }

    #[test]
    fn creates_structured_output_schemas() {
        let metadata = output_schema_for_kind(AiActionKind::GenerateMetadata).unwrap();
        assert_eq!(metadata["additionalProperties"], false);
        assert_eq!(metadata["properties"]["tags"]["items"]["type"], "string");

        let review = output_schema_for_kind(AiActionKind::ReviewDocument).unwrap();
        assert_eq!(
            review["properties"]["issues"]["items"]["properties"]["severity"]["enum"],
            json!(["info", "warning", "critical"])
        );
        assert!(output_schema_for_kind(AiActionKind::PolishDocument).is_none());
    }

    #[test]
    fn normalizes_fenced_output() {
        assert_eq!(
            normalize_ai_action_text("```markdown\n# Polished\n```"),
            "# Polished"
        );
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
}

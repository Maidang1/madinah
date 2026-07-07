use crate::commands::ai::{AiDocumentReview, AiDocumentReviewIssue, AiMetadataSuggestion};
use crate::error::AppError;
use serde_json::Value;

pub(crate) const ACP_RESULT_START: &str = "MADINAH_WRITER_RESULT_START";
pub(crate) const ACP_RESULT_END: &str = "MADINAH_WRITER_RESULT_END";
pub(crate) const DEFAULT_POLISH_INSTRUCTION: &str = "Polish the Markdown body for clarity, fluency, and natural expression. Preserve the original meaning, facts, Markdown structure, links, code fences, and MDX/JSX components. Return only the polished Markdown body.";

pub(crate) fn build_acp_action_prompt(kind: &str, content: &str, instruction: &str) -> String {
    let content = content.trim();
    let trimmed_instruction = if (kind == "generate-metadata" || kind == "review-document")
        && instruction.trim() == DEFAULT_POLISH_INSTRUCTION
    {
        ""
    } else {
        instruction.trim()
    };
    let extra_instruction = if trimmed_instruction.is_empty() {
        String::new()
    } else {
        format!("\n\nAdditional writing instruction:\n{trimmed_instruction}")
    };

    if kind == "rewrite-selection" {
        return format!(
            "Rewrite the selected Markdown for clarity, fluency, and natural expression.{extra_instruction}\n\nRules:\n- Return only the rewritten selected Markdown.\n- Preserve factual meaning, Markdown structure, links, code fences, and MDX/JSX components.\n- Do not add commentary or wrap the result in a code fence.\n{}\n\nSelected Markdown:\n<<<MADINAH_WRITER_SELECTION\n{content}\nMADINAH_WRITER_SELECTION",
            build_acp_result_envelope_instruction(),
        );
    }

    if kind == "generate-metadata" {
        return format!(
            "Generate publication metadata for the Markdown body.{extra_instruction}\n\nReturn only valid JSON with this exact shape:\n{{\n  \"title\": \"string\",\n  \"description\": \"string\",\n  \"tags\": [\"string\"],\n  \"slug\": \"string\"\n}}\n\nRules:\n- Keep the title concise and specific.\n- Keep description under 180 characters.\n- Return 3 to 6 lowercase tags when possible.\n- Use a URL-safe kebab-case slug.\n- Do not include Markdown fences or explanatory text.\n{}\n\nMarkdown body:\n<<<MADINAH_WRITER_BODY\n{content}\nMADINAH_WRITER_BODY",
            build_acp_result_envelope_instruction(),
        );
    }

    if kind == "review-document" {
        return format!(
            "Review the Markdown document for structure, clarity, and publishing readiness.{extra_instruction}\n\nReturn only valid JSON with this exact shape:\n{{\n  \"summary\": \"string\",\n  \"issues\": [\n    {{\n      \"severity\": \"info | warning | critical\",\n      \"title\": \"string\",\n      \"detail\": \"string\",\n      \"suggestion\": \"string\"\n    }}\n  ]\n}}\n\nRules:\n- Prefer concrete issues over generic advice.\n- Use \"critical\" only for issues that block publication or make the article misleading.\n- Keep every field concise.\n- Do not include Markdown fences or explanatory text.\n{}\n\nMarkdown body:\n<<<MADINAH_WRITER_BODY\n{content}\nMADINAH_WRITER_BODY",
            build_acp_result_envelope_instruction(),
        );
    }

    let final_instruction = if trimmed_instruction.is_empty() {
        "Polish the Markdown body for clarity, fluency, and natural expression."
    } else {
        trimmed_instruction
    };

    format!(
        "{final_instruction}\n\nRules:\n- Return only the polished Markdown body.\n- Preserve Markdown structure, links, code fences, MDX/JSX components, and factual meaning.\n- Keep frontmatter out of the output.\n{}\n\nMarkdown body:\n<<<MADINAH_WRITER_BODY\n{content}\nMADINAH_WRITER_BODY",
        build_acp_result_envelope_instruction(),
    )
}

fn build_acp_result_envelope_instruction() -> String {
    format!(
        "- Put the final payload between {ACP_RESULT_START} and {ACP_RESULT_END}.\n- Do not put warnings, notes, or explanations outside those markers."
    )
}

pub(crate) fn normalize_acp_action_text(value: &str) -> String {
    let without_diagnostics = strip_acp_diagnostic_output(value);
    let enveloped = extract_acp_result_envelope(&without_diagnostics);
    let trimmed = enveloped.as_deref().unwrap_or(&without_diagnostics).trim();
    strip_markdown_fence(trimmed).trim().to_string()
}

fn strip_acp_diagnostic_output(value: &str) -> String {
    value
        .lines()
        .filter(|line| !is_acp_diagnostic_line(line))
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn is_acp_diagnostic_line(line: &str) -> bool {
    let normalized = strip_ansi_codes(line).trim().to_string();
    normalized.starts_with("Warning: Skill descriptions were shortened to fit the ")
        && normalized.ends_with("% skills context budget.")
}

fn strip_ansi_codes(value: &str) -> String {
    let mut result = String::with_capacity(value.len());
    let mut chars = value.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\u{1b}' && chars.peek() == Some(&'[') {
            chars.next();
            for next in chars.by_ref() {
                if next.is_ascii_alphabetic() {
                    break;
                }
            }
            continue;
        }
        result.push(ch);
    }
    result
}

fn extract_acp_result_envelope(value: &str) -> Option<String> {
    let mut rest = value;
    let mut last = None;
    while let Some(start_index) = rest.find(ACP_RESULT_START) {
        let after_start = &rest[start_index + ACP_RESULT_START.len()..];
        let Some(end_index) = after_start.find(ACP_RESULT_END) else {
            break;
        };
        last = Some(after_start[..end_index].trim().to_string());
        rest = &after_start[end_index + ACP_RESULT_END.len()..];
    }
    last
}

fn strip_markdown_fence(value: &str) -> &str {
    let trimmed = value.trim();
    if !trimmed.starts_with("```") || !trimmed.ends_with("```") {
        return trimmed;
    }

    let Some(first_newline) = trimmed.find('\n') else {
        return trimmed;
    };
    let body_with_closing = &trimmed[first_newline + 1..];
    let Some(last_newline) = body_with_closing.rfind('\n') else {
        return trimmed;
    };
    if body_with_closing[last_newline + 1..].trim() != "```" {
        return trimmed;
    }
    &body_with_closing[..last_newline]
}

pub(crate) fn parse_ai_metadata_suggestion(value: &str) -> Result<AiMetadataSuggestion, AppError> {
    let parsed = parse_acp_json_object(value, "metadata suggestion")?;
    let title = string_field(&parsed, "title", true, "metadata")?;
    let description = string_field(&parsed, "description", true, "metadata")?;
    let tags = parsed
        .get("tags")
        .and_then(Value::as_array)
        .map(|items| {
            let mut tags = Vec::new();
            for item in items {
                let tag = item
                    .as_str()
                    .map(str::to_string)
                    .unwrap_or_else(|| item.to_string())
                    .trim()
                    .to_lowercase();
                if !tag.is_empty() && !tags.contains(&tag) {
                    tags.push(tag);
                }
            }
            tags
        })
        .unwrap_or_default();
    let slug = slug_field(parsed.get("slug"), &title);

    Ok(AiMetadataSuggestion {
        title,
        description,
        tags,
        slug,
    })
}

pub(crate) fn parse_ai_document_review(value: &str) -> Result<AiDocumentReview, AppError> {
    let parsed = parse_acp_json_object(value, "document review")?;
    let summary = string_field(&parsed, "summary", true, "review")?;
    let issues = parsed
        .get("issues")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let issue = item.as_object()?;
                    let title = string_field_map(issue, "title", false).ok()?;
                    let detail = string_field_map(issue, "detail", false).ok()?;
                    let suggestion = string_field_map(issue, "suggestion", false).ok()?;
                    if title.is_empty() && detail.is_empty() && suggestion.is_empty() {
                        return None;
                    }
                    Some(AiDocumentReviewIssue {
                        severity: review_severity(issue.get("severity")),
                        title: if title.is_empty() {
                            "Writing issue".into()
                        } else {
                            title
                        },
                        detail,
                        suggestion,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(AiDocumentReview { summary, issues })
}

fn parse_acp_json_object(
    value: &str,
    label: &str,
) -> Result<serde_json::Map<String, Value>, AppError> {
    let normalized = normalize_acp_action_text(value);
    match serde_json::from_str::<Value>(&normalized) {
        Ok(Value::Object(object)) => Ok(object),
        _ => Err(AppError::Invalid(format!(
            "AI agent returned invalid {label} JSON"
        ))),
    }
}

fn string_field(
    record: &serde_json::Map<String, Value>,
    key: &str,
    required: bool,
    label: &str,
) -> Result<String, AppError> {
    string_field_map(record, key, required)
        .map_err(|_| AppError::Invalid(format!("AI agent returned {label} without {key}")))
}

fn string_field_map(
    record: &serde_json::Map<String, Value>,
    key: &str,
    required: bool,
) -> Result<String, ()> {
    let text = record
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim()
        .to_string();
    if text.is_empty() && required {
        Err(())
    } else {
        Ok(text)
    }
}

fn slug_field(value: Option<&Value>, fallback: &str) -> String {
    let raw = value
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(fallback);
    create_slug(raw)
}

fn create_slug(value: &str) -> String {
    let mut slug = String::new();
    let mut last_was_dash = false;
    for ch in value.trim().chars().flat_map(char::to_lowercase) {
        if ch == '\'' || ch == '"' {
            continue;
        }
        if ch.is_alphanumeric() {
            slug.push(ch);
            last_was_dash = false;
            continue;
        }
        if !last_was_dash && !slug.is_empty() {
            slug.push('-');
            last_was_dash = true;
        }
    }
    while slug.ends_with('-') {
        slug.pop();
    }
    if slug.is_empty() {
        "untitled".into()
    } else {
        slug
    }
}

fn review_severity(value: Option<&Value>) -> String {
    match value.and_then(Value::as_str) {
        Some(severity @ ("critical" | "warning" | "info")) => severity.into(),
        _ => "info".into(),
    }
}

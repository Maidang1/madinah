use crate::commands::ai::{AiDocumentReview, AiDocumentReviewIssue, AiMetadataSuggestion};
use crate::error::AppError;
use serde_json::Value;

pub(crate) const DEFAULT_POLISH_INSTRUCTION: &str = "Polish the Markdown body for clarity, fluency, and natural expression. Preserve the original meaning, facts, Markdown structure, links, code fences, and MDX/JSX components. Return only the polished Markdown body.";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AiActionKind {
    PolishDocument,
    RewriteSelection,
    ShortenSelection,
    ExpandSelection,
    TranslateSelection,
    ContinueWriting,
    GenerateOutline,
    GenerateMetadata,
    ReviewDocument,
}

impl AiActionKind {
    pub(crate) fn parse(value: &str) -> Option<Self> {
        match value {
            "polish-document" => Some(Self::PolishDocument),
            "rewrite-selection" => Some(Self::RewriteSelection),
            "shorten-selection" => Some(Self::ShortenSelection),
            "expand-selection" => Some(Self::ExpandSelection),
            "translate-selection" => Some(Self::TranslateSelection),
            "continue-writing" => Some(Self::ContinueWriting),
            "generate-outline" => Some(Self::GenerateOutline),
            "generate-metadata" => Some(Self::GenerateMetadata),
            "review-document" => Some(Self::ReviewDocument),
            _ => None,
        }
    }

    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::PolishDocument => "polish-document",
            Self::RewriteSelection => "rewrite-selection",
            Self::ShortenSelection => "shorten-selection",
            Self::ExpandSelection => "expand-selection",
            Self::TranslateSelection => "translate-selection",
            Self::ContinueWriting => "continue-writing",
            Self::GenerateOutline => "generate-outline",
            Self::GenerateMetadata => "generate-metadata",
            Self::ReviewDocument => "review-document",
        }
    }
}

pub(crate) fn build_ai_action_prompt(
    kind: AiActionKind,
    content: &str,
    instruction: &str,
) -> String {
    let content = content.trim();
    let trimmed_instruction = if instruction.trim() == DEFAULT_POLISH_INSTRUCTION {
        ""
    } else {
        instruction.trim()
    };
    let extra_instruction = if trimmed_instruction.is_empty() {
        String::new()
    } else {
        format!("\n\nAdditional writing instruction:\n{trimmed_instruction}")
    };

    match kind {
        AiActionKind::RewriteSelection => build_selection_prompt(
            "Rewrite the selected Markdown for clarity, fluency, and natural expression.",
            "- Preserve the original length unless clarity requires a change.",
            &extra_instruction,
            content,
        ),
        AiActionKind::ShortenSelection => build_selection_prompt(
            "Shorten the selected Markdown while preserving its essential meaning.",
            "- Reduce length by roughly 30 to 50 percent when the material allows it.\n- Remove repetition, filler, and weak transitions before removing useful facts.",
            &extra_instruction,
            content,
        ),
        AiActionKind::ExpandSelection => build_selection_prompt(
            "Expand the selected Markdown with useful detail, clearer reasoning, and natural transitions.",
            "- Add depth while staying within the facts provided.\n- Do not invent names, numbers, sources, quotations, or events.",
            &extra_instruction,
            content,
        ),
        AiActionKind::TranslateSelection => build_selection_prompt(
            "Translate the selected Markdown. Translate predominantly Chinese prose into natural English; translate other prose into Simplified Chinese.",
            "- Translate prose, headings, labels, and image alt text.\n- Preserve URLs, code, inline code, code fences, MDX/JSX syntax, and Markdown structure.\n- Keep established technical names in their conventional form.",
            &extra_instruction,
            content,
        ),
        AiActionKind::ContinueWriting => format!(
            "Continue the Markdown document at the exact cursor marker.{extra_instruction}\n\nRules:\n- Return only the new Markdown to insert at the cursor.\n- Match the document's primary language, voice, tense, structure, and formatting.\n- Use both preceding and following text to create a natural continuation.\n- Add one to three focused paragraphs or the structurally appropriate equivalent.\n- Do not repeat existing text, mention the cursor marker, add commentary, or wrap the result in a code fence.\n- Preserve factual boundaries and do not invent names, numbers, sources, quotations, or events.\n\nMarkdown document with insertion point:\n<<<MADINAH_WRITER_DOCUMENT\n{content}\nMADINAH_WRITER_DOCUMENT",
        ),
        AiActionKind::GenerateOutline => format!(
            "Generate a concise writing outline for the Markdown document.{extra_instruction}\n\nRules:\n- Return only the outline in the document's primary language.\n- Start with `## 大纲` for a Chinese document or `## Outline` for an English document.\n- Use nested Markdown bullet lists for sections and supporting points.\n- Reflect the document's actual argument and facts; include missing structural opportunities only when clearly useful.\n- Do not add anchor links, commentary, frontmatter, or a code fence.\n\nMarkdown body:\n<<<MADINAH_WRITER_BODY\n{content}\nMADINAH_WRITER_BODY",
        ),
        AiActionKind::GenerateMetadata => format!(
            "Generate publication metadata for the Markdown body.{extra_instruction}\n\nReturn only valid JSON with this exact shape:\n{{\n  \"title\": \"string\",\n  \"description\": \"string\",\n  \"tags\": [\"string\"],\n  \"slug\": \"string\"\n}}\n\nRules:\n- Keep the title concise and specific.\n- Keep description under 180 characters.\n- Return 3 to 6 lowercase tags when possible.\n- Use a URL-safe kebab-case slug.\n- Do not include Markdown fences or explanatory text.\n\nMarkdown body:\n<<<MADINAH_WRITER_BODY\n{content}\nMADINAH_WRITER_BODY",
        ),
        AiActionKind::ReviewDocument => format!(
            "Review the Markdown document for structure, clarity, and publishing readiness.{extra_instruction}\n\nReturn only valid JSON with this exact shape:\n{{\n  \"summary\": \"string\",\n  \"issues\": [\n    {{\n      \"severity\": \"info | warning | critical\",\n      \"title\": \"string\",\n      \"detail\": \"string\",\n      \"suggestion\": \"string\"\n    }}\n  ]\n}}\n\nRules:\n- Prefer concrete issues over generic advice.\n- Use \"critical\" only for issues that block publication or make the article misleading.\n- Keep every field concise.\n- Do not include Markdown fences or explanatory text.\n\nMarkdown body:\n<<<MADINAH_WRITER_BODY\n{content}\nMADINAH_WRITER_BODY",
        ),
        AiActionKind::PolishDocument => {
            let final_instruction = if trimmed_instruction.is_empty() {
                DEFAULT_POLISH_INSTRUCTION
            } else {
                trimmed_instruction
            };
            format!(
                "{final_instruction}\n\nRules:\n- Return only the polished Markdown body.\n- Preserve Markdown structure, links, code fences, MDX/JSX components, and factual meaning.\n- Keep frontmatter out of the output.\n\nMarkdown body:\n<<<MADINAH_WRITER_BODY\n{content}\nMADINAH_WRITER_BODY",
            )
        }
    }
}

fn build_selection_prompt(
    request: &str,
    action_rules: &str,
    extra_instruction: &str,
    content: &str,
) -> String {
    format!(
        "{request}{extra_instruction}\n\nRules:\n- Return only the transformed selected Markdown.\n- Preserve factual meaning, Markdown structure, links, code fences, and MDX/JSX components.\n- Do not add commentary or wrap the result in a code fence.\n{action_rules}\n\nSelected Markdown:\n<<<MADINAH_WRITER_SELECTION\n{content}\nMADINAH_WRITER_SELECTION",
    )
}

pub(crate) fn normalize_ai_action_text(value: &str) -> String {
    strip_markdown_fence(value.trim()).trim().to_string()
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
    let parsed = parse_ai_json_object(value, "metadata suggestion")?;
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
    let parsed = parse_ai_json_object(value, "document review")?;
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

fn parse_ai_json_object(
    value: &str,
    label: &str,
) -> Result<serde_json::Map<String, Value>, AppError> {
    let normalized = normalize_ai_action_text(value);
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

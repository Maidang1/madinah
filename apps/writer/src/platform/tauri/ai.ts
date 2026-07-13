import { invoke } from "@tauri-apps/api/core";

export interface AiSettings {
  schemaVersion: 2;
  codexPath: string;
  model: string;
  instruction: string;
  timeoutSeconds: number;
}

export interface AiCheckResult {
  ok: boolean;
  message: string;
}

export interface AiMetadataSuggestion {
  title: string;
  description: string;
  tags: string[];
  slug: string;
}

export type AiDocumentReviewIssueSeverity = "info" | "warning" | "critical";

export interface AiDocumentReviewIssue {
  severity: AiDocumentReviewIssueSeverity;
  title: string;
  detail: string;
  suggestion: string;
}

export interface AiDocumentReview {
  summary: string;
  issues: AiDocumentReviewIssue[];
}

export const AI_ACTION_KINDS = [
  "polish-document",
  "rewrite-selection",
  "shorten-selection",
  "expand-selection",
  "translate-selection",
  "continue-writing",
  "generate-outline",
  "generate-metadata",
  "review-document",
] as const;

export type AiActionKind = (typeof AI_ACTION_KINDS)[number];

export interface AiActionInput {
  kind: AiActionKind;
  content: string;
  workspaceRoot?: string | null;
}

export interface AiActionResult {
  kind: AiActionInput["kind"];
  content: string;
  provider: "codex";
  metadata?: AiMetadataSuggestion;
  review?: AiDocumentReview;
}

export function loadAiSettings(): Promise<AiSettings> {
  return invoke("load_ai_settings");
}

export function saveAiSettings(settings: AiSettings): Promise<AiSettings> {
  return invoke("save_ai_settings", { settings });
}

export function checkAiSettings(settings: AiSettings): Promise<AiCheckResult> {
  return invoke("check_ai_settings", { settings });
}

export function runAiAction(input: AiActionInput): Promise<AiActionResult> {
  return invoke("run_ai_action", { input });
}

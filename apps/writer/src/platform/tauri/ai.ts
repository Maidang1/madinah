import { invoke } from "@tauri-apps/api/core";

export type AiAgentProvider = "codex" | "claude";

export interface AiEnvVar {
  name: string;
  value: string;
}

export interface AiAgentSettings {
  command: string;
  env: AiEnvVar[];
  instruction: string;
  timeoutSeconds: number;
}

export interface AiSettings {
  schemaVersion: 1;
  provider: AiAgentProvider;
  agents: Record<AiAgentProvider, AiAgentSettings>;
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

export interface AiActionInput {
  kind: "polish-document" | "rewrite-selection" | "generate-metadata" | "review-document";
  content: string;
  workspaceRoot?: string | null;
}

export interface AiActionResult {
  kind: AiActionInput["kind"];
  content: string;
  provider: AiAgentProvider;
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

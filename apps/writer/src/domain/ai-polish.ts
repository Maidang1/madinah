export type AcpAgentProvider = "codex" | "claude";

export interface AcpEnvVar {
  name: string;
  value: string;
}

export interface AcpAgentRuntimeConfig {
  provider: AcpAgentProvider;
  command: string;
  env: AcpEnvVar[];
  instruction: string;
  timeoutSeconds: number;
}

export type AiActionKind =
  | "polish-document"
  | "rewrite-selection"
  | "generate-metadata"
  | "review-document";

export type AiOperationState =
  | {
      status: "idle";
      commandId: null;
      label: string;
      detail: string;
    }
  | {
      status: "running" | "success" | "error";
      commandId: string;
      label: string;
      detail: string;
    };

export const EMPTY_AI_OPERATION_STATE: AiOperationState = {
  status: "idle",
  commandId: null,
  label: "",
  detail: "",
};

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

export type AiDocumentReviewState =
  | {
      status: "idle";
      message: string;
      review: null;
      updatedAt: null;
    }
  | {
      status: "loading";
      message: string;
      review: null;
      updatedAt: null;
    }
  | {
      status: "ready";
      message: string;
      review: AiDocumentReview;
      updatedAt: string;
    }
  | {
      status: "error";
      message: string;
      review: null;
      updatedAt: null;
    };

export interface AcpAiActionInput extends AcpAgentRuntimeConfig {
  kind: AiActionKind;
  content: string;
  workspaceRoot?: string | null;
}

export interface AcpAiActionResult {
  kind: AiActionKind;
  content: string;
  provider: AcpAgentProvider;
  metadata?: AiMetadataSuggestion;
  review?: AiDocumentReview;
}

export type AcpPolishInput = Omit<AcpAiActionInput, "kind">;
export type AcpPolishResult = Omit<AcpAiActionResult, "kind">;

export interface AcpAgentCheckResult {
  ok: boolean;
  agentName?: string | null;
  message: string;
}

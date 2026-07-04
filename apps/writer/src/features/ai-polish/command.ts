import type {
  AcpAgentProvider,
  AcpAiActionInput,
  AiActionKind,
  AiDocumentReviewState,
  AiOperationState,
} from "../../domain/ai-polish";
import type { DocumentMetadataPatch } from "../../domain/document";
import type { WorkspaceInfo, WriterCommand } from "../../domain/engine";
import type { AiAdapter } from "../../platform/ports";
import {
  ACP_PROVIDER_LABEL,
  DEFAULT_POLISH_INSTRUCTION,
  getSelectedAcpRuntimeConfig,
  type AcpSettings,
} from "./settings";

interface AiPolishCommandOptions {
  ai: AiAdapter;
  settings: AcpSettings;
  setStatus: (status: string) => void;
  setOperationState?: (state: AiOperationState) => void;
}

interface AiWriterCommandOptions extends AiPolishCommandOptions {
  changeMetadata: (patch: DocumentMetadataPatch) => void;
  saveVersion: (reason: string) => void;
  setReviewState: (state: AiDocumentReviewState) => void;
  showReview: () => void;
}

interface MarkdownEditorLike {
  getMarkdown?: () => string;
  setMarkdown?: (value: string) => void;
  getSelectionMarkdown?: () => string;
  replaceSelection?: (markdown: string) => void;
  focus?: (
    callbackFn?: () => void,
    opts?: { defaultSelection?: "rootStart" | "rootEnd"; preventScroll?: boolean },
  ) => void;
}

export const AI_POLISH_COMMAND_ID = "ai.polish.document";
export const AI_REWRITE_SELECTION_COMMAND_ID = "ai.rewriteSelection";
export const AI_GENERATE_METADATA_COMMAND_ID = "ai.generateMetadata";
export const AI_REVIEW_DOCUMENT_COMMAND_ID = "ai.reviewDocument";

export const EMPTY_AI_REVIEW_STATE: AiDocumentReviewState = {
  status: "idle",
  message: "Run AI review to inspect this document",
  review: null,
  updatedAt: null,
};

export function createAiCommands(options: AiWriterCommandOptions): WriterCommand[] {
  return [
    createAiPolishCommand(options),
    createAiRewriteSelectionCommand(options),
    createAiGenerateMetadataCommand(options),
    createAiReviewDocumentCommand(options),
  ];
}

export function createAiPolishCommand(
  options: AiPolishCommandOptions,
): WriterCommand {
  return {
    id: AI_POLISH_COMMAND_ID,
    label: "AI Polish",
    group: "AI",
    keywords: ["rewrite", "polish", "improve"],
    scope: "ai",
    surfaces: ["palette", "context"],
    priority: 70,
    run: async ({ document, editor, workspace }) => {
      const target = editor as MarkdownEditorLike | null;
      const content = target?.getMarkdown?.() ?? document?.body ?? "";
      if (!content.trim()) {
        throw new Error("Nothing to polish");
      }

      const config = getSelectedAcpRuntimeConfig(options.settings);
      const providerLabel = formatProviderLabel(config.provider);
      const operation = createAiOperationDescriptor(
        AI_POLISH_COMMAND_ID,
        "Polishing document",
        `${providerLabel} is rewriting the document`,
      );
      options.setStatus(`Polishing with ${providerLabel}`);
      setAiOperation(options, "running", operation);

      try {
        const result = await options.ai.runAction({
          ...toActionConfig(config, "polish-document"),
          content,
          workspaceRoot: getWorkspaceRoot(workspace),
        });
        const polished = normalizePolishOutput(result.content);
        if (!polished) {
          throw new Error("Agent returned empty content");
        }

        target?.setMarkdown?.(polished);
        target?.focus?.(undefined, {
          defaultSelection: "rootStart",
          preventScroll: true,
        });
        options.setStatus(`Polished with ${providerLabel}`);
        setAiOperation(options, "success", {
          ...operation,
          detail: `Applied changes from ${providerLabel}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        options.setStatus(`Polish failed: ${message}`);
        setAiOperation(options, "error", {
          ...operation,
          detail: message,
        });
        throw error;
      }
    },
  };
}

export function createAiRewriteSelectionCommand(
  options: AiWriterCommandOptions,
): WriterCommand {
  return {
    id: AI_REWRITE_SELECTION_COMMAND_ID,
    label: "Rewrite Selection",
    group: "AI",
    keywords: ["rewrite", "selection", "polish", "improve"],
    scope: "ai",
    surfaces: ["palette", "context"],
    priority: 74,
    run: async ({ editor, workspace }) => {
      const target = editor as MarkdownEditorLike | null;
      const selection = target?.getSelectionMarkdown?.().trim() ?? "";
      if (!selection) {
        throw new Error("Select text to rewrite");
      }

      const config = getActionRuntimeConfig(options.settings, "rewrite-selection");
      const providerLabel = formatProviderLabel(config.provider);
      const operation = createAiOperationDescriptor(
        AI_REWRITE_SELECTION_COMMAND_ID,
        "Rewriting selection",
        `${providerLabel} is improving the selected text`,
      );
      options.setStatus(`Rewriting selection with ${providerLabel}`);
      setAiOperation(options, "running", operation);

      try {
        options.saveVersion("AI: Rewrite selection");
        const result = await options.ai.runAction({
          ...toActionConfig(config, "rewrite-selection"),
          content: selection,
          workspaceRoot: getWorkspaceRoot(workspace),
        });
        const rewritten = normalizePolishOutput(result.content);
        if (!rewritten) {
          throw new Error("Agent returned empty content");
        }

        target?.replaceSelection?.(rewritten);
        target?.focus?.(undefined, {
          defaultSelection: "rootEnd",
          preventScroll: true,
        });
        options.setStatus(`Rewritten with ${providerLabel}`);
        setAiOperation(options, "success", {
          ...operation,
          detail: `Selection replaced by ${providerLabel}`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        options.setStatus(`Rewrite failed: ${message}`);
        setAiOperation(options, "error", {
          ...operation,
          detail: message,
        });
        throw error;
      }
    },
  };
}

export function createAiGenerateMetadataCommand(
  options: AiWriterCommandOptions,
): WriterCommand {
  return {
    id: AI_GENERATE_METADATA_COMMAND_ID,
    label: "Generate Metadata",
    group: "AI",
    keywords: ["frontmatter", "metadata", "title", "description", "tags", "slug"],
    scope: "ai",
    surfaces: ["palette", "context"],
    priority: 73,
    run: async ({ document, editor, workspace }) => {
      const target = editor as MarkdownEditorLike | null;
      const content = target?.getMarkdown?.() ?? document?.body ?? "";
      if (!content.trim()) {
        throw new Error("Nothing to analyze");
      }

      const config = getActionRuntimeConfig(options.settings, "generate-metadata");
      const providerLabel = formatProviderLabel(config.provider);
      const operation = createAiOperationDescriptor(
        AI_GENERATE_METADATA_COMMAND_ID,
        "Generating metadata",
        `${providerLabel} is reading the document`,
      );
      options.setStatus(`Generating metadata with ${providerLabel}`);
      setAiOperation(options, "running", operation);

      try {
        options.saveVersion("AI: Generate metadata");
        const result = await options.ai.runAction({
          ...toActionConfig(config, "generate-metadata"),
          content,
          workspaceRoot: getWorkspaceRoot(workspace),
        });
        if (!result.metadata) {
          throw new Error("Agent returned metadata without parsed result");
        }

        options.changeMetadata({
          title: result.metadata.title,
          description: result.metadata.description,
          tags: result.metadata.tags,
          slug: result.metadata.slug,
        });
        options.setStatus(`Metadata generated with ${providerLabel}`);
        setAiOperation(options, "success", {
          ...operation,
          detail: `Title, description, tags, and slug updated`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        options.setStatus(`Metadata generation failed: ${message}`);
        setAiOperation(options, "error", {
          ...operation,
          detail: message,
        });
        throw error;
      }
    },
  };
}

export function createAiReviewDocumentCommand(
  options: AiWriterCommandOptions,
): WriterCommand {
  return {
    id: AI_REVIEW_DOCUMENT_COMMAND_ID,
    label: "Review Document",
    group: "AI",
    keywords: ["review", "issues", "structure", "clarity"],
    scope: "ai",
    surfaces: ["palette", "context"],
    priority: 72,
    run: async ({ document, editor, workspace }) => {
      const target = editor as MarkdownEditorLike | null;
      const content = target?.getMarkdown?.() ?? document?.body ?? "";
      if (!content.trim()) {
        throw new Error("Nothing to review");
      }

      const config = getActionRuntimeConfig(options.settings, "review-document");
      const providerLabel = formatProviderLabel(config.provider);
      const operation = createAiOperationDescriptor(
        AI_REVIEW_DOCUMENT_COMMAND_ID,
        "Reviewing document",
        `${providerLabel} is checking structure and clarity`,
      );
      options.showReview();
      options.setReviewState({
        status: "loading",
        message: `Reviewing with ${providerLabel}`,
        review: null,
        updatedAt: null,
      });
      options.setStatus(`Reviewing with ${providerLabel}`);
      setAiOperation(options, "running", operation);

      try {
        const result = await options.ai.runAction({
          ...toActionConfig(config, "review-document"),
          content,
          workspaceRoot: getWorkspaceRoot(workspace),
        });
        if (!result.review) {
          throw new Error("Agent returned review without parsed result");
        }

        options.setReviewState({
          status: "ready",
          message: `Reviewed with ${providerLabel}`,
          review: result.review,
          updatedAt: new Date().toISOString(),
        });
        options.setStatus(`Reviewed with ${providerLabel}`);
        setAiOperation(options, "success", {
          ...operation,
          detail: `Review result is ready`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        options.setReviewState({
          status: "error",
          message,
          review: null,
          updatedAt: null,
        });
        options.setStatus(`Review failed: ${message}`);
        setAiOperation(options, "error", {
          ...operation,
          detail: message,
        });
        throw error;
      }
    },
  };
}

export function normalizePolishOutput(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function getWorkspaceRoot(workspace?: WorkspaceInfo | null): string | null {
  if (!workspace || workspace.root.startsWith("browser://")) return null;
  return workspace.root;
}

function createAiOperationDescriptor(
  commandId: string,
  label: string,
  detail: string,
) {
  return { commandId, label, detail };
}

function setAiOperation(
  options: AiPolishCommandOptions,
  status: Extract<AiOperationState["status"], "running" | "success" | "error">,
  operation: ReturnType<typeof createAiOperationDescriptor>,
) {
  options.setOperationState?.({
    status,
    commandId: operation.commandId,
    label: operation.label,
    detail: operation.detail,
  });
}

function getActionRuntimeConfig(
  settings: AcpSettings,
  kind: AiActionKind,
) {
  const config = getSelectedAcpRuntimeConfig(settings);
  if (
    (kind === "generate-metadata" || kind === "review-document") &&
    config.instruction === DEFAULT_POLISH_INSTRUCTION
  ) {
    return {
      ...config,
      instruction: "",
    };
  }
  return config;
}

function toActionConfig(
  config: ReturnType<typeof getSelectedAcpRuntimeConfig>,
  kind: AcpAiActionInput["kind"],
): Omit<AcpAiActionInput, "content" | "workspaceRoot"> {
  return {
    ...config,
    kind,
  };
}

function formatProviderLabel(provider: AcpAgentProvider): string {
  return ACP_PROVIDER_LABEL[provider];
}

import type { AcpAgentProvider } from "../../domain/ai-polish";
import type { WorkspaceInfo, WriterCommand } from "../../domain/engine";
import type { AiPolishAdapter } from "../../platform/ports";
import {
  ACP_PROVIDER_LABEL,
  getSelectedAcpRuntimeConfig,
  type AcpSettings,
} from "./settings";

interface AiPolishCommandOptions {
  aiPolish: AiPolishAdapter;
  settings: AcpSettings;
  setStatus: (status: string) => void;
}

interface MarkdownEditorLike {
  getMarkdown?: () => string;
  setMarkdown?: (value: string) => void;
  focus?: (
    callbackFn?: () => void,
    opts?: { defaultSelection?: "rootStart" | "rootEnd"; preventScroll?: boolean },
  ) => void;
}

export const AI_POLISH_COMMAND_ID = "ai.polish.document";

export function createAiPolishCommand(
  options: AiPolishCommandOptions,
): WriterCommand {
  return {
    id: AI_POLISH_COMMAND_ID,
    label: "AI Polish",
    run: async ({ document, editor, workspace }) => {
      const target = editor as MarkdownEditorLike | null;
      const content = target?.getMarkdown?.() ?? document?.body ?? "";
      if (!content.trim()) {
        throw new Error("Nothing to polish");
      }

      const config = getSelectedAcpRuntimeConfig(options.settings);
      const providerLabel = formatProviderLabel(config.provider);
      options.setStatus(`Polishing with ${providerLabel}`);

      try {
        const result = await options.aiPolish.polish({
          ...config,
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        options.setStatus(`Polish failed: ${message}`);
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

function formatProviderLabel(provider: AcpAgentProvider): string {
  return ACP_PROVIDER_LABEL[provider];
}

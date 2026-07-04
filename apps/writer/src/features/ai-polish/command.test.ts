import { describe, expect, it, vi } from "vitest";
import type { AiOperationState } from "../../domain/ai-polish";
import type { AiAdapter } from "../../platform/ports";
import { createDefaultAcpSettings } from "./settings";
import {
  AI_GENERATE_METADATA_COMMAND_ID,
  AI_POLISH_COMMAND_ID,
  AI_REVIEW_DOCUMENT_COMMAND_ID,
  AI_REWRITE_SELECTION_COMMAND_ID,
  createAiGenerateMetadataCommand,
  createAiPolishCommand,
  createAiReviewDocumentCommand,
  createAiRewriteSelectionCommand,
  normalizePolishOutput,
} from "./command";

describe("AI commands", () => {
  it("exposes the legacy document polish command", () => {
    const command = createAiPolishCommand({
      ai: createAdapter(vi.fn()),
      settings: createDefaultAcpSettings(),
      setStatus: () => {},
    });

    expect(command).toMatchObject({
      id: AI_POLISH_COMMAND_ID,
      label: "AI Polish",
    });
  });

  it("replaces the current document body with polished markdown", async () => {
    const settings = createDefaultAcpSettings();
    const runAction = vi.fn(async () => ({
      kind: "polish-document" as const,
      provider: "codex" as const,
      content: "```markdown\n# Polished\n\nBetter body.\n```",
    }));
    const editor = createEditor("# Draft\n\nrough body");
    const statuses: string[] = [];
    const operations: AiOperationState[] = [];
    const command = createAiPolishCommand({
      ai: createAdapter(runAction),
      settings,
      setStatus: (status) => statuses.push(status),
      setOperationState: (state) => operations.push(state),
    });

    await command.run({
      document: null,
      editor,
      workspace: { root: "/tmp/project", profile: "gfm", plugins: [] },
    });

    expect(runAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "polish-document",
        provider: "codex",
        content: "# Draft\n\nrough body",
        workspaceRoot: "/tmp/project",
      }),
    );
    expect(editor.markdown).toBe("# Polished\n\nBetter body.");
    expect(statuses).toEqual(["Polishing with Codex", "Polished with Codex"]);
    expect(operations).toEqual([
      expect.objectContaining({
        status: "running",
        commandId: AI_POLISH_COMMAND_ID,
        label: "Polishing document",
      }),
      expect.objectContaining({
        status: "success",
        commandId: AI_POLISH_COMMAND_ID,
        detail: "Applied changes from Codex",
      }),
    ]);
  });

  it("rewrites only the active selection", async () => {
    const runAction = vi.fn(async () => ({
      kind: "rewrite-selection" as const,
      provider: "codex" as const,
      content: "Better selection",
    }));
    const editor = createEditor("# Draft", "rough selection");
    const saveVersion = vi.fn();
    const command = createAiRewriteSelectionCommand({
      ...createWriterOptions(runAction),
      saveVersion,
    });

    await command.run({
      document: null,
      editor,
      workspace: { root: "browser://local", profile: "gfm", plugins: [] },
    });

    expect(command.id).toBe(AI_REWRITE_SELECTION_COMMAND_ID);
    expect(runAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "rewrite-selection",
        content: "rough selection",
        workspaceRoot: null,
      }),
    );
    expect(saveVersion).toHaveBeenCalledWith("AI: Rewrite selection");
    expect(editor.replacedSelection).toBe("Better selection");
  });

  it("rejects rewrite when the selection is empty", async () => {
    const command = createAiRewriteSelectionCommand(
      createWriterOptions(vi.fn()),
    );

    await expect(
      command.run({
        document: null,
        editor: createEditor("# Draft", "   "),
      }),
    ).rejects.toThrow("Select text to rewrite");
  });

  it("generates metadata from the current body", async () => {
    const runAction = vi.fn(async () => ({
      kind: "generate-metadata" as const,
      provider: "codex" as const,
      content: "{}",
      metadata: {
        title: "Madinah AI",
        description: "A concise description.",
        tags: ["ai", "writer"],
        slug: "madinah-ai",
      },
    }));
    const changeMetadata = vi.fn();
    const saveVersion = vi.fn();
    const command = createAiGenerateMetadataCommand({
      ...createWriterOptions(runAction),
      changeMetadata,
      saveVersion,
    });

    await command.run({
      document: null,
      editor: createEditor("# Draft\n\nBody"),
      workspace: { root: "/tmp/project", profile: "gfm", plugins: [] },
    });

    expect(command.id).toBe(AI_GENERATE_METADATA_COMMAND_ID);
    expect(runAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "generate-metadata",
        content: "# Draft\n\nBody",
        instruction: "",
      }),
    );
    expect(saveVersion).toHaveBeenCalledWith("AI: Generate metadata");
    expect(changeMetadata).toHaveBeenCalledWith({
      title: "Madinah AI",
      description: "A concise description.",
      tags: ["ai", "writer"],
      slug: "madinah-ai",
    });
  });

  it("writes document review state without changing the document", async () => {
    const runAction = vi.fn(async () => ({
      kind: "review-document" as const,
      provider: "codex" as const,
      content: "{}",
      review: {
        summary: "Clear structure with one weak section.",
        issues: [
          {
            severity: "warning" as const,
            title: "Weak opening",
            detail: "The first paragraph is vague.",
            suggestion: "Start with the concrete claim.",
          },
        ],
      },
    }));
    const setReviewState = vi.fn();
    const showReview = vi.fn();
    const command = createAiReviewDocumentCommand({
      ...createWriterOptions(runAction),
      setReviewState,
      showReview,
    });

    await command.run({
      document: null,
      editor: createEditor("# Draft\n\nBody"),
    });

    expect(command.id).toBe(AI_REVIEW_DOCUMENT_COMMAND_ID);
    expect(showReview).toHaveBeenCalledTimes(1);
    expect(setReviewState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: "loading" }),
    );
    expect(setReviewState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: "ready",
        review: expect.objectContaining({
          summary: "Clear structure with one weak section.",
        }),
      }),
    );
  });

  it("falls back to the document body when editor methods are absent", async () => {
    const runAction = vi.fn(async () => ({
      kind: "polish-document" as const,
      provider: "codex" as const,
      content: "# Result",
    }));
    const command = createAiPolishCommand({
      ai: createAdapter(runAction),
      settings: createDefaultAcpSettings(),
      setStatus: () => {},
    });

    await command.run({
      document: {
        id: "doc-1",
        slug: "draft",
        title: "Draft",
        description: "",
        author: "Madinah",
        tags: [],
        status: "draft",
        pubDate: "2026-06-28 10:00:00",
        body: "# Draft",
        createdAt: "2026-06-28T02:00:00.000Z",
        updatedAt: "2026-06-28T02:00:00.000Z",
      },
      workspace: { root: "browser://local", profile: "gfm", plugins: [] },
    });

    expect(runAction).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "# Draft",
        workspaceRoot: null,
      }),
    );
  });

  it("rejects empty documents", async () => {
    const command = createAiPolishCommand({
      ai: createAdapter(vi.fn()),
      settings: createDefaultAcpSettings(),
      setStatus: () => {},
    });

    await expect(
      command.run({
        document: null,
        editor: createEditor("   "),
      }),
    ).rejects.toThrow("Nothing to polish");
  });

  it("publishes an error operation state when polish fails", async () => {
    const operations: AiOperationState[] = [];
    const command = createAiPolishCommand({
      ai: createAdapter(
        vi.fn(async () => {
          throw new Error("Agent timed out");
        }),
      ),
      settings: createDefaultAcpSettings(),
      setStatus: () => {},
      setOperationState: (state) => operations.push(state),
    });

    await expect(
      command.run({
        document: null,
        editor: createEditor("# Draft"),
      }),
    ).rejects.toThrow("Agent timed out");

    expect(operations).toEqual([
      expect.objectContaining({ status: "running" }),
      expect.objectContaining({
        status: "error",
        commandId: AI_POLISH_COMMAND_ID,
        detail: "Agent timed out",
      }),
    ]);
  });

  it("normalizes fenced agent output", () => {
    expect(normalizePolishOutput("```md\n# Title\n```")).toBe("# Title");
    expect(normalizePolishOutput("\n# Title\n")).toBe("# Title");
  });
});

function createWriterOptions(runAction: AiAdapter["runAction"]) {
  return {
    ai: createAdapter(runAction),
    settings: createDefaultAcpSettings(),
    setStatus: () => {},
    changeMetadata: vi.fn(),
    saveVersion: vi.fn(),
    setReviewState: vi.fn(),
    showReview: vi.fn(),
  };
}

function createAdapter(runAction: AiAdapter["runAction"]): AiAdapter {
  return {
    isAvailable: true,
    runAction,
    async check() {
      return { ok: true, message: "Connected" };
    },
  };
}

function createEditor(markdown: string, selection = "") {
  return {
    markdown,
    replacedSelection: "",
    getMarkdown() {
      return this.markdown;
    },
    setMarkdown(value: string) {
      this.markdown = value;
    },
    getSelectionMarkdown() {
      return selection;
    },
    replaceSelection(value: string) {
      this.replacedSelection = value;
    },
    focus: vi.fn(),
  };
}

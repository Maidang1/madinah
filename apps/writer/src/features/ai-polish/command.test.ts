import { describe, expect, it, vi } from "vitest";
import type { AiPolishAdapter } from "../../platform/ports";
import { createDefaultAcpSettings } from "./settings";
import {
  AI_POLISH_COMMAND_ID,
  createAiPolishCommand,
  normalizePolishOutput,
} from "./command";

describe("AI polish command", () => {
  it("exposes a writer command", () => {
    const command = createAiPolishCommand({
      aiPolish: createAdapter(vi.fn()),
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
    const polish = vi.fn(async () => ({
      provider: "codex" as const,
      content: "```markdown\n# Polished\n\nBetter body.\n```",
    }));
    const editor = createEditor("# Draft\n\nrough body");
    const statuses: string[] = [];
    const command = createAiPolishCommand({
      aiPolish: createAdapter(polish),
      settings,
      setStatus: (status) => statuses.push(status),
    });

    await command.run({
      document: null,
      editor,
      workspace: { root: "/tmp/project", profile: "gfm", plugins: [] },
    });

    expect(polish).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "codex",
        content: "# Draft\n\nrough body",
        workspaceRoot: "/tmp/project",
      }),
    );
    expect(editor.markdown).toBe("# Polished\n\nBetter body.");
    expect(statuses).toEqual(["Polishing with Codex", "Polished with Codex"]);
  });

  it("falls back to the document body when editor methods are absent", async () => {
    const polish = vi.fn(async () => ({
      provider: "codex" as const,
      content: "# Result",
    }));
    const command = createAiPolishCommand({
      aiPolish: createAdapter(polish),
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

    expect(polish).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "# Draft",
        workspaceRoot: null,
      }),
    );
  });

  it("rejects empty documents", async () => {
    const command = createAiPolishCommand({
      aiPolish: createAdapter(vi.fn()),
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

  it("normalizes fenced agent output", () => {
    expect(normalizePolishOutput("```md\n# Title\n```")).toBe("# Title");
    expect(normalizePolishOutput("\n# Title\n")).toBe("# Title");
  });
});

function createAdapter(
  polish: AiPolishAdapter["polish"],
): AiPolishAdapter {
  return {
    isAvailable: true,
    polish,
    async check() {
      return { ok: true, message: "Connected" };
    },
  };
}

function createEditor(markdown: string) {
  return {
    markdown,
    getMarkdown() {
      return this.markdown;
    },
    setMarkdown(value: string) {
      this.markdown = value;
    },
    focus: vi.fn(),
  };
}

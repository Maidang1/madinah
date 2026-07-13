import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { getEditorCommand } from "../src/components/editor-area/editor-commands";

const mockedInvoke = vi.mocked(invoke);

describe("AI editor text actions", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  test("shortens the selected range through one replace transaction", async () => {
    const editor = fakeEditor("Long draft", 0, 4);
    mockedInvoke.mockResolvedValue({
      kind: "shorten-selection",
      content: "Brief",
      provider: "codex",
    });

    await getEditorCommand("ai.shortenSelection")?.run(editor.view, "/draft.md");

    expect(mockedInvoke).toHaveBeenCalledWith("run_ai_action", {
      input: {
        kind: "shorten-selection",
        content: "Long",
        workspaceRoot: null,
      },
    });
    expect(editor.text()).toBe("Brief draft");
    expect(editor.selection()).toEqual({ from: 0, to: 5 });
  });

  test("continues writing at the cursor with document context", async () => {
    const editor = fakeEditor("# Draft", 7);
    mockedInvoke.mockResolvedValue({
      kind: "continue-writing",
      content: "Next paragraph.",
      provider: "codex",
    });

    await getEditorCommand("ai.continueWriting")?.run(editor.view, "/draft.md");

    const input = mockedInvoke.mock.calls[0]?.[1] as {
      input: { kind: string; content: string };
    };
    expect(input.input.kind).toBe("continue-writing");
    expect(input.input.content).toBe("# Draft\n<<<MADINAH_WRITER_CURSOR>>>\n");
    expect(editor.text()).toBe("# Draft\n\nNext paragraph.");
    expect(editor.selection()).toEqual({ from: 9, to: 24 });
  });

  test("preserves user edits made while Codex is running", async () => {
    const editor = fakeEditor("Original text", 0, 8);
    let resolveResult: ((value: unknown) => void) | undefined;
    mockedInvoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveResult = resolve;
        }),
    );

    const running = getEditorCommand("ai.rewriteSelection")?.run(editor.view, "/draft.md");
    editor.replace(0, 0, "New ");
    resolveResult?.({ kind: "rewrite-selection", content: "Changed", provider: "codex" });

    await expect(running).rejects.toThrow("Document changed while AI was running");
    expect(editor.text()).toBe("New Original text");
  });
});

function fakeEditor(document: string, anchor: number, head = anchor) {
  let state = EditorState.create({
    doc: document,
    selection: { anchor, head },
  });
  const view = {
    get state() {
      return state;
    },
    dispatch(spec: Record<string, unknown>) {
      const { userEvent: _userEvent, ...transactionSpec } = spec;
      state = state.update(transactionSpec).state;
    },
    focus() {},
  } as unknown as EditorView;

  return {
    view,
    text: () => state.doc.toString(),
    selection: () => ({
      from: state.selection.main.from,
      to: state.selection.main.to,
    }),
    replace(from: number, to: number, insert: string) {
      state = state.update({ changes: { from, to, insert } }).state;
    },
  };
}

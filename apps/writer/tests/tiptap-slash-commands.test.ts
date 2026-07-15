import { describe, expect, test } from "vite-plus/test";
import type { Editor } from "@tiptap/react";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import {
  getTiptapSlashCommandItems,
  getTiptapSlashTrigger,
  runTiptapSlashCommand,
} from "../src/components/editor-area/tiptap-slash-commands";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "text*", group: "block" },
    text: { group: "inline" },
  },
});

describe("TipTap slash commands", () => {
  test("exposes only block commands supported by the active TipTap editor", () => {
    const ids = getTiptapSlashCommandItems().map((item) => item.id);

    expect(ids).toContain("format.paragraph");
    expect(ids).toContain("format.heading2");
    expect(ids).toContain("format.taskList");
    expect(ids).toContain("toggleFencedCodeBlock");
    expect(ids).toContain("insertHorizontalRule");
    expect(ids).not.toContain("insertImage");
    expect(ids).not.toContain("ai.polishDocument");
  });

  test("derives the absolute replacement range from ProseMirror state", () => {
    expect(getTiptapSlashTrigger(stateWithCaret("/heading 2"))).toEqual({
      from: 1,
      to: 11,
      query: "heading 2",
    });
    expect(getTiptapSlashTrigger(stateWithCaret("hello /hea"))).toEqual({
      from: 7,
      to: 11,
      query: "hea",
    });
    expect(getTiptapSlashTrigger(stateWithCaret("path/to"))).toBeNull();
  });

  test("deletes the trigger and transforms the block through one TipTap chain", () => {
    const calls: unknown[] = [];
    const chain = {
      focus: () => {
        calls.push("focus");
        return chain;
      },
      deleteRange: (range: unknown) => {
        calls.push(["deleteRange", range]);
        return chain;
      },
      setHeading: (attributes: unknown) => {
        calls.push(["setHeading", attributes]);
        return chain;
      },
      run: () => {
        calls.push("run");
        return true;
      },
    };
    const editor = { chain: () => chain } as unknown as Editor;

    expect(runTiptapSlashCommand(editor, "format.heading2", { from: 4, to: 7 })).toBe(true);
    expect(calls).toEqual([
      "focus",
      ["deleteRange", { from: 4, to: 7 }],
      ["setHeading", { level: 2 }],
      "run",
    ]);
  });
});

function stateWithCaret(text: string): EditorState {
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, text ? schema.text(text) : []),
  ]);
  return EditorState.create({
    doc,
    selection: TextSelection.create(doc, text.length + 1),
  });
}

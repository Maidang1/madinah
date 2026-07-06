import { describe, expect, test } from "vite-plus/test";
import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { EditorCommand } from "../src/components/editor-area/editor-commands";
import { getEditorCommandsForSurface } from "../src/components/editor-area/editor-commands";
import { __testSlashCommandExtension } from "../src/components/editor-area/slash-command-extension";
import {
  createSlashCommandItems,
  getSlashCommandPosition,
  matchSlashCommandTriggerText,
  searchSlashCommandItems,
} from "../src/components/editor-area/slash-commands";

describe("slash commands", () => {
  test("builds and sorts slash items by priority", () => {
    const items = createSlashCommandItems([
      command("document.save", "Save", 99, []),
      command("insertTable", "Table", 50, ["slash"]),
      command("ai.polishDocument", "Polish document", 80, ["slash"]),
    ]);

    expect(items.map((item) => item.id)).toEqual(["ai.polishDocument", "insertTable"]);
  });

  test("searches label, group, keywords, and command id", () => {
    const items = createSlashCommandItems([
      command("format.heading2", "Heading 2", 80, ["slash"], ["subtitle"]),
      command("insertTable", "Table", 70, ["slash"], ["grid"]),
      command("ai.rewriteSelection", "Rewrite selection", 90, ["slash"], ["polish"]),
    ]);

    expect(searchSlashCommandItems(items, "head").map((item) => item.id)).toEqual([
      "format.heading2",
    ]);
    expect(searchSlashCommandItems(items, "grid").map((item) => item.id)).toEqual(["insertTable"]);
    expect(searchSlashCommandItems(items, "rewrite").map((item) => item.id)).toEqual([
      "ai.rewriteSelection",
    ]);
  });

  test("finds Markdown snippet insertions from the slash surface", () => {
    const items = createSlashCommandItems(getEditorCommandsForSurface("slash"));

    expect(searchSlashCommandItems(items, "image").map((item) => item.id)).toContain("insertImage");
    expect(searchSlashCommandItems(items, "callout").map((item) => item.id)).toContain(
      "insertCallout",
    );
    expect(searchSlashCommandItems(items, "latex").map((item) => item.id)).toContain(
      "insertMathBlock",
    );
    expect(searchSlashCommandItems(items, "frontmatter").map((item) => item.id)).toContain(
      "insertFrontmatter",
    );
  });

  test("matches slash triggers at line start and after whitespace", () => {
    expect(matchSlashCommandTriggerText("/")).toEqual({
      query: "",
      slashOffset: 0,
      atLineStart: true,
    });
    expect(matchSlashCommandTriggerText("  /table")).toEqual({
      query: "table",
      slashOffset: 2,
      atLineStart: true,
    });
    expect(matchSlashCommandTriggerText("hello /ai")).toEqual({
      query: "ai",
      slashOffset: 6,
      atLineStart: false,
    });
    expect(matchSlashCommandTriggerText("a/b")).toBeNull();
    expect(matchSlashCommandTriggerText("/two words")).toBeNull();
  });

  test("keeps the menu inside the viewport", () => {
    expect(
      getSlashCommandPosition(
        { left: 760, top: 560, bottom: 580 },
        { width: 280, height: 340 },
        { width: 800, height: 600 },
      ),
    ).toEqual({
      x: 512,
      y: 212,
    });
  });

  test("falls back to line geometry when caret coords are unavailable", () => {
    const state = EditorState.create({ doc: "/" });
    const view = {
      state,
      documentTop: 100,
      coordsAtPos: (pos: number) =>
        pos === 0 ? { left: 120, top: 0, bottom: 20, right: 120 } : null,
      lineBlockAt: () => ({ top: 40, bottom: 64 }),
      dom: {
        getBoundingClientRect: () => ({ left: 24 }),
      },
    } as unknown as EditorView;

    expect(__testSlashCommandExtension.getSlashAnchorRect(view, 1)).toEqual({
      left: 120,
      top: 140,
      bottom: 164,
    });
  });

  test("scrolls the selected item into view after rendering", () => {
    const calls: unknown[] = [];
    const menu = {
      querySelector: (selector: string) =>
        selector === "button.is-selected"
          ? {
              scrollIntoView: (options: unknown) => calls.push(options),
            }
          : null,
    } as unknown as HTMLElement;

    __testSlashCommandExtension.scrollSelectedSlashItem(menu);

    expect(calls).toEqual([{ block: "nearest" }]);
  });
});

function command(
  id: string,
  label: string,
  priority: number,
  surfaces: Array<"context" | "slash">,
  keywords: string[] = [],
): EditorCommand {
  return {
    id,
    label,
    group: id.startsWith("ai.") ? "AI" : "Insert",
    description: label,
    keywords,
    priority,
    surfaces,
    run: () => {},
  };
}

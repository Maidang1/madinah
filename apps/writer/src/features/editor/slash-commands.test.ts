import { describe, expect, it } from "vitest";
import type { WriterCommand } from "../../domain/engine";
import {
  createSlashCommandItems,
  getSlashCommandPosition,
  matchSlashCommandTriggerText,
  replaceSlashTriggerInMarkdown,
  searchSlashCommandItems,
} from "./slash-commands";

describe("slash commands", () => {
  it("builds writing-first slash items from insert and selected format commands", () => {
    const items = createSlashCommandItems([
      command("editor.insert.paragraph", "Text", "insert", ["Text", "Plain paragraph"]),
      command("editor.insert.h2", "Heading 2", "insert", ["Text", "subtitle"]),
      command("editor.format.bold", "Bold", "edit", ["strong"]),
      command("editor.format.table", "Table", "insert", ["grid"]),
      command("ai.polish.document", "AI Polish", "ai", ["rewrite"]),
      command("document.save", "Save", "file"),
    ]);

    expect(items.map((item) => item.id)).toEqual([
      "editor.insert.paragraph",
      "editor.insert.h2",
      "editor.format.bold",
    ]);
    expect(items[0]).toMatchObject({
      group: "Text",
      label: "Text",
    });
  });

  it("searches label, group, keywords, and command id", () => {
    const items = createSlashCommandItems([
      command("editor.insert.h2", "Heading 2", "insert", ["Text", "subtitle"]),
      command("editor.insert.checklist", "Checklist", "insert", ["Lists", "todo"]),
      command("editor.insert.table", "Table", "insert", ["Blocks", "grid"]),
    ]);

    expect(searchSlashCommandItems(items, "head").map((item) => item.id)).toEqual([
      "editor.insert.h2",
    ]);
    expect(searchSlashCommandItems(items, "todo").map((item) => item.id)).toEqual([
      "editor.insert.checklist",
    ]);
    expect(searchSlashCommandItems(items, "h2").map((item) => item.id)).toEqual([
      "editor.insert.h2",
    ]);
  });

  it("matches slash triggers only at the start of a block", () => {
    expect(matchSlashCommandTriggerText("/")).toEqual({
      query: "",
      slashOffset: 0,
    });
    expect(matchSlashCommandTriggerText("  /table")).toEqual({
      query: "table",
      slashOffset: 2,
    });
    expect(matchSlashCommandTriggerText("hello /table")).toBeNull();
    expect(matchSlashCommandTriggerText("/two words")).toBeNull();
  });

  it("keeps the menu inside the viewport", () => {
    expect(
      getSlashCommandPosition(
        { left: 760, right: 760, top: 560, bottom: 580, width: 0, height: 20 },
        { width: 280, height: 340 },
        { width: 800, height: 600 },
      ),
    ).toEqual({
      x: 512,
      y: 212,
    });
  });

  it("replaces the active slash line with markdown insertion", () => {
    expect(
      replaceSlashTriggerInMarkdown(
        "# hello world\n\n/",
        "/",
        "### Heading 3\n\n",
      ),
    ).toBe("# hello world\n\n### Heading 3\n\n");

    expect(
      replaceSlashTriggerInMarkdown(
        "# hello world\n\n/h3",
        "/h3",
        "### Heading 3\n\n",
      ),
    ).toBe("# hello world\n\n### Heading 3\n\n");

    expect(
      replaceSlashTriggerInMarkdown("Body\n\n  /table", "  /table", "| x |\n"),
    ).toBe("Body\n\n| x |\n");
  });
});

function command(
  id: string,
  label: string,
  scope: string,
  keywords: string[] = [],
): WriterCommand {
  return {
    id,
    label,
    group: scope === "insert" ? "Insert" : "Commands",
    keywords,
    scope,
    run: () => {},
  };
}

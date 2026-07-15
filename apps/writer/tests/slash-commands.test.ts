import { describe, expect, test } from "vite-plus/test";
import {
  createSlashCommandItems,
  getSlashCommandPosition,
  groupSlashCommandItems,
  matchSlashCommandTriggerText,
  searchSlashCommandItems,
  type SlashCommandDescriptor,
} from "../src/components/editor-area/slash-commands";

describe("slash command utilities", () => {
  test("sorts, searches, and groups command descriptors", () => {
    const items = createSlashCommandItems([
      command("insert.image", "Image", "Media & inserts", 70, ["media"]),
      command("format.heading2", "Heading 2", "Basic blocks", 80, ["subtitle"]),
      command("format.paragraph", "Paragraph", "Basic blocks", 90, ["text"]),
    ]);

    expect(items.map((item) => item.id)).toEqual([
      "format.paragraph",
      "format.heading2",
      "insert.image",
    ]);
    expect(searchSlashCommandItems(items, "subtitle").map((item) => item.id)).toEqual([
      "format.heading2",
    ]);
    expect(groupSlashCommandItems(items).map((group) => group.section)).toEqual([
      "Basic blocks",
      "Media & inserts",
    ]);
  });

  test("matches slash triggers at line start and after whitespace", () => {
    expect(matchSlashCommandTriggerText("/")).toEqual({
      query: "",
      slashOffset: 0,
      atLineStart: true,
    });
    expect(matchSlashCommandTriggerText("hello /heading 2")).toEqual({
      query: "heading 2",
      slashOffset: 6,
      atLineStart: false,
    });
    expect(matchSlashCommandTriggerText("path/to")).toBeNull();
  });

  test("keeps the menu inside the viewport", () => {
    expect(
      getSlashCommandPosition(
        { left: 760, top: 560, bottom: 580 },
        { width: 280, height: 340 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ x: 512, y: 212 });
  });
});

function command(
  id: string,
  label: string,
  section: SlashCommandDescriptor["section"],
  priority: number,
  keywords: string[],
): SlashCommandDescriptor {
  return {
    id,
    label,
    group: section,
    section,
    description: label,
    icon: "+",
    keywords,
    priority,
  };
}

import { describe, expect, it } from "vitest";
import type { SlashCommand } from "../../domain/engine";
import { createSlashCommandSections } from "./slash-command-menu";

describe("slash command menu helpers", () => {
  it("groups visible commands in stable order for an empty query", () => {
    expect(createSlashCommandSections(commands, "")).toEqual([
      {
        group: "Text",
        commands: [commands[0]],
      },
      {
        group: "Blocks",
        commands: [commands[1]],
      },
      {
        group: "Commands",
        commands: [commands[2]],
      },
    ]);
  });

  it("matches commands by label, hint, id, group, and keywords", () => {
    expect(flattenIds("hero")).toEqual(["callout-note"]);
    expect(flattenIds("blockquote")).toEqual(["quote"]);
    expect(flattenIds("callout-note")).toEqual(["callout-note"]);
    expect(flattenIds("blocks")).toEqual(["quote"]);
    expect(flattenIds("aside")).toEqual(["callout-note"]);
  });

  it("returns no sections when filtering has no matches", () => {
    expect(createSlashCommandSections(commands, "diagram")).toEqual([]);
  });
});

const commands: SlashCommand[] = [
  {
    id: "callout-note",
    label: "Note callout",
    hint: "Highlighted context",
    group: "Text",
    keywords: ["aside", "hero"],
    commandId: "editor.insert.callout-note",
  },
  {
    id: "quote",
    label: "Quote",
    hint: "Blockquote",
    group: "Blocks",
    commandId: "editor.insert.quote",
  },
  {
    id: "plugin-command",
    label: "Plugin command",
    hint: "Workspace action",
    commandId: "plugin.command",
  },
];

function flattenIds(query: string): string[] {
  return createSlashCommandSections(commands, query).flatMap((section) =>
    section.commands.map((command) => command.id),
  );
}

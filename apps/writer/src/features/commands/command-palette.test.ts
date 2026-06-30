import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WriterCommand } from "../../domain/engine";
import { createFormattingCommands } from "../editor/formatting-commands";
import { createBuiltinProfiles } from "../engine/builtinProfiles";
import { createDocumentCommands } from "../session/document-commands";
import { createWorkbenchCommands } from "../workbench/workbench-commands";
import {
  CommandPalette,
  createCommandPaletteItems,
  groupCommandPaletteItems,
  searchCommandPaletteItems,
} from "./command-palette";

describe("command palette", () => {
  it("searches command labels, groups, and keywords with label matches first", () => {
    const commands: WriterCommand[] = [
      { id: "view.focusMode", label: "Focus Mode", group: "View", run: () => {} },
      {
        id: "document.search",
        label: "Find in Document",
        group: "Navigate",
        keywords: ["search", "current file"],
        run: () => {},
      },
      {
        id: "editor.format.bold",
        label: "Bold",
        group: "Format",
        keywords: ["strong"],
        run: () => {},
      },
    ];

    const items = createCommandPaletteItems(commands);

    expect(searchCommandPaletteItems(items, "find").map((item) => item.id)).toEqual([
      "document.search",
    ]);
    expect(searchCommandPaletteItems(items, "view").map((item) => item.id)).toEqual([
      "view.focusMode",
    ]);
    expect(searchCommandPaletteItems(items, "strong").map((item) => item.id)).toEqual([
      "editor.format.bold",
    ]);
  });

  it("keeps command metadata on palette items", () => {
    const items = createCommandPaletteItems([
      {
        id: "document.save",
        label: "Save",
        group: "File",
        shortcut: "⌘S",
        scope: "file",
        priority: 100,
        run: () => {},
      },
    ]);

    expect(items[0]).toMatchObject({
      id: "document.save",
      shortcut: "⌘S",
      scope: "file",
      priority: 100,
    });
  });

  it("places high-priority commands first for an empty query", () => {
    const items = createCommandPaletteItems([
      { id: "low", label: "Low", group: "View", priority: 10, run: () => {} },
      { id: "high", label: "High", group: "File", priority: 90, run: () => {} },
      { id: "middle", label: "Middle", group: "Edit", priority: 50, run: () => {} },
    ]);

    expect(searchCommandPaletteItems(items, "").map((item) => item.id)).toEqual([
      "high",
      "middle",
      "low",
    ]);
  });

  it("groups sorted command results by their display group", () => {
    const items = createCommandPaletteItems([
      { id: "document.save", label: "Save", group: "File", priority: 100, run: () => {} },
      { id: "editor.format.bold", label: "Bold", group: "Edit", priority: 90, run: () => {} },
      { id: "view.quickOpen", label: "Quick Open", group: "File", priority: 80, run: () => {} },
      { id: "editor.format.italic", label: "Italic", group: "Edit", priority: 70, run: () => {} },
    ]);

    expect(
      groupCommandPaletteItems(searchCommandPaletteItems(items, "")).map((group) => ({
        group: group.group,
        ids: group.items.map((item) => item.id),
      })),
    ).toEqual([
      { group: "File", ids: ["document.save", "view.quickOpen"] },
      { group: "Edit", ids: ["editor.format.bold", "editor.format.italic"] },
    ]);
  });

  it("renders grouped results with shortcut hints", () => {
    const commands: WriterCommand[] = [
      {
        id: "document.save",
        label: "Save",
        group: "File",
        shortcut: "⌘S",
        priority: 100,
        run: () => {},
      },
      {
        id: "view.commandPalette",
        label: "Command Palette",
        group: "View",
        shortcut: "⇧⌘P",
        priority: 90,
        run: () => {},
      },
    ];

    const html = renderToStaticMarkup(
      createElement(CommandPalette, {
        commands,
        query: "",
        onQueryChange: () => {},
        onClose: () => {},
        onRun: () => {},
      }),
    );

    expect(html).toContain("command-palette-group-label");
    expect(html).toContain("File");
    expect(html).toContain("View");
    expect(html).toContain("command-palette-shortcut");
    expect(html).toContain('aria-activedescendant="command-palette-option-document-save"');
    expect(html).toContain('id="command-palette-option-document-save"');
    expect(html).toContain("⌘S");
    expect(html).toContain("⇧⌘P");
  });

  it("renders the active query in the empty state", () => {
    const html = renderToStaticMarkup(
      createElement(CommandPalette, {
        commands: [
          {
            id: "document.save",
            label: "Save",
            run: () => {},
          },
        ],
        query: "publish",
        onQueryChange: () => {},
        onClose: () => {},
        onRun: () => {},
      }),
    );

    expect(html).toContain("No commands for");
    expect(html).toContain("publish");
  });

  it("adds shortcut metadata to common built-in commands", () => {
    const commands = [
      ...createDocumentCommands({
        newDocument: () => {},
        open: () => {},
        save: () => {},
        saveAs: () => {},
        revert: () => {},
        close: () => {},
      }),
      ...createWorkbenchCommands({
        dispatch: () => {},
        openDocumentSearch: () => {},
        openCommandPalette: () => {},
        openQuickOpen: () => {},
      }),
      ...createFormattingCommands(),
    ];
    const shortcutsById = Object.fromEntries(
      createCommandPaletteItems(commands).map((item) => [item.id, item.shortcut]),
    );

    expect(shortcutsById).toMatchObject({
      "document.save": "⌘S",
      "view.quickOpen": "⌘P",
      "view.commandPalette": "⇧⌘P",
      "document.search": "⌘F",
      "editor.format.bold": "⌃B",
      "editor.format.italic": "⌘I",
      "editor.format.link": "⌘K",
    });
  });

  it("groups profile insert commands under Insert in search results", () => {
    const gfm = createBuiltinProfiles().find((profile) => profile.id === "gfm");
    const items = createCommandPaletteItems(gfm?.commands ?? []);
    const insertGroups = groupCommandPaletteItems(
      searchCommandPaletteItems(items, "insert"),
    );

    expect(insertGroups).toHaveLength(1);
    expect(insertGroups[0].group).toBe("Insert");
    expect(insertGroups[0].items.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "editor.insert.table",
        "editor.insert.checklist",
        "editor.insert.footnote",
      ]),
    );
  });
});

import { describe, expect, it } from "vitest";
import type { WorkbenchAction } from "./workbench-state";
import { createWorkbenchCommands } from "./workbench-commands";

describe("workbench commands", () => {
  it("keeps existing workbench command ids and adds view and inspector commands", () => {
    expect(createCommands().map((command) => command.id)).toEqual([
      "document.search",
      "view.commandPalette",
      "view.quickOpen",
      "view.toggleSidebar",
      "view.toggleInspector",
      "view.focusMode",
      "view.typewriterMode",
      "go.outline",
      "view.write",
      "view.preview",
      "view.source",
      "inspector.showOutline",
      "inspector.showProperties",
      "inspector.showStats",
      "inspector.showHistory",
    ]);
  });

  it("runs existing overlay commands through their handlers", () => {
    const opened: string[] = [];
    const commands = createCommands({
      openDocumentSearch: () => opened.push("search"),
      openCommandPalette: () => opened.push("commands"),
      openQuickOpen: () => opened.push("quick-open"),
    });

    run(commands, "document.search");
    run(commands, "view.commandPalette");
    run(commands, "view.quickOpen");

    expect(opened).toEqual(["search", "commands", "quick-open"]);
  });

  it("dispatches layout, view mode, and inspector actions", () => {
    const actions: WorkbenchAction[] = [];
    const commands = createCommands({
      dispatch: (action) => actions.push(action),
    });

    run(commands, "view.toggleSidebar");
    run(commands, "view.toggleInspector");
    run(commands, "view.focusMode");
    run(commands, "view.typewriterMode");
    run(commands, "go.outline");
    run(commands, "view.write");
    run(commands, "view.preview");
    run(commands, "view.source");
    run(commands, "inspector.showOutline");
    run(commands, "inspector.showProperties");
    run(commands, "inspector.showStats");
    run(commands, "inspector.showHistory");

    expect(actions).toEqual([
      { type: "toggleSidebar" },
      { type: "toggleInspector" },
      { type: "toggleFocusMode" },
      { type: "toggleTypewriterMode" },
      { type: "showInspectorTab", tab: "outline" },
      { type: "setViewMode", viewMode: "write" },
      { type: "setViewMode", viewMode: "preview" },
      { type: "setEditorMode", editorMode: "source" },
      { type: "showInspectorTab", tab: "outline" },
      { type: "showInspectorTab", tab: "properties" },
      { type: "showInspectorTab", tab: "stats" },
      { type: "showInspectorTab", tab: "history" },
    ]);
  });
});

type CreateCommandOverrides = Partial<Parameters<typeof createWorkbenchCommands>[0]>;

function createCommands(overrides: CreateCommandOverrides = {}) {
  return createWorkbenchCommands({
    dispatch: () => {},
    openDocumentSearch: () => {},
    openCommandPalette: () => {},
    openQuickOpen: () => {},
    ...overrides,
  });
}

function run(commands: ReturnType<typeof createWorkbenchCommands>, id: string) {
  const command = commands.find((candidate) => candidate.id === id);
  expect(command, `Missing command ${id}`).toBeDefined();
  command?.run({ document: null });
}

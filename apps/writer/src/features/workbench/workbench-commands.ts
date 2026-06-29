import type { WriterCommand } from "../../domain/engine";
import type { InspectorTab, WorkbenchAction } from "./workbench-state";

export interface WorkbenchCommandOptions {
  dispatch: (action: WorkbenchAction) => void;
  openDocumentSearch: () => void;
  openCommandPalette: () => void;
  openQuickOpen: () => void;
}

export function createWorkbenchCommands({
  dispatch,
  openDocumentSearch,
  openCommandPalette,
  openQuickOpen,
}: WorkbenchCommandOptions): WriterCommand[] {
  return [
    {
      id: "document.search",
      label: "Find in Document",
      group: "Edit",
      keywords: ["search", "find", "current file"],
      shortcut: "⌘F",
      scope: "edit",
      priority: 110,
      run: openDocumentSearch,
    },
    {
      id: "view.commandPalette",
      label: "Command Palette",
      group: "View",
      keywords: ["commands"],
      shortcut: "⇧⌘P",
      scope: "view",
      priority: 130,
      run: openCommandPalette,
    },
    {
      id: "view.quickOpen",
      label: "Quick Open",
      group: "File",
      keywords: ["files", "documents"],
      shortcut: "⌘P",
      scope: "file",
      priority: 115,
      run: openQuickOpen,
    },
    {
      id: "view.toggleSidebar",
      label: "Toggle Sidebar",
      group: "View",
      keywords: ["files"],
      shortcut: "⌥⌘S",
      scope: "view",
      priority: 60,
      run: () => dispatch({ type: "toggleSidebar" }),
    },
    {
      id: "view.toggleInspector",
      label: "Toggle Inspector",
      group: "View",
      keywords: ["properties", "outline"],
      shortcut: "⌥⌘I",
      scope: "view",
      priority: 55,
      run: () => dispatch({ type: "toggleInspector" }),
    },
    {
      id: "view.focusMode",
      label: "Focus Mode",
      group: "View",
      keywords: ["zen"],
      shortcut: "⌥⌘F",
      scope: "view",
      priority: 50,
      run: () => dispatch({ type: "toggleFocusMode" }),
    },
    {
      id: "view.typewriterMode",
      label: "Typewriter Mode",
      group: "View",
      keywords: ["writing"],
      shortcut: "⌥⌘T",
      scope: "view",
      priority: 45,
      run: () => dispatch({ type: "toggleTypewriterMode" }),
    },
    {
      id: "go.outline",
      label: "Show Outline",
      group: "View",
      keywords: ["toc", "headings"],
      shortcut: "⌥⌘O",
      scope: "view",
      priority: 40,
      run: () => dispatch({ type: "showInspectorTab", tab: "outline" }),
    },
    {
      id: "view.write",
      label: "Write Mode",
      group: "View",
      keywords: ["editor", "writing"],
      scope: "view",
      priority: 35,
      run: () => dispatch({ type: "setViewMode", viewMode: "write" }),
    },
    {
      id: "view.preview",
      label: "Preview Mode",
      group: "View",
      keywords: ["render", "reader"],
      scope: "view",
      priority: 34,
      run: () => dispatch({ type: "setViewMode", viewMode: "preview" }),
    },
    ...createInspectorTabCommands(dispatch),
  ];
}

function createInspectorTabCommands(
  dispatch: (action: WorkbenchAction) => void,
): WriterCommand[] {
  return [
    createInspectorTabCommand(
      "inspector.showOutline",
      "Show Outline",
      "outline",
      ["toc", "headings"],
      dispatch,
    ),
    createInspectorTabCommand(
      "inspector.showProperties",
      "Show Properties",
      "properties",
      ["metadata", "frontmatter"],
      dispatch,
    ),
    createInspectorTabCommand(
      "inspector.showStats",
      "Show Writing Stats",
      "stats",
      ["words", "characters"],
      dispatch,
    ),
    createInspectorTabCommand(
      "inspector.showHistory",
      "Show History",
      "history",
      ["versions", "restore"],
      dispatch,
    ),
  ];
}

function createInspectorTabCommand(
  id: string,
  label: string,
  tab: InspectorTab,
  keywords: string[],
  dispatch: (action: WorkbenchAction) => void,
): WriterCommand {
  return {
    id,
    label,
    group: "View",
    keywords,
    scope: "view",
    priority: 20,
    run: () => dispatch({ type: "showInspectorTab", tab }),
  };
}

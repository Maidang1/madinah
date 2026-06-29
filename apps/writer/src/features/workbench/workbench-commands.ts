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
      group: "Navigate",
      keywords: ["search", "find", "current file"],
      run: openDocumentSearch,
    },
    {
      id: "view.commandPalette",
      label: "Command Palette",
      group: "View",
      keywords: ["commands"],
      run: openCommandPalette,
    },
    {
      id: "view.quickOpen",
      label: "Quick Open",
      group: "Navigate",
      keywords: ["files", "documents"],
      run: openQuickOpen,
    },
    {
      id: "view.toggleSidebar",
      label: "Toggle Sidebar",
      group: "View",
      keywords: ["files"],
      run: () => dispatch({ type: "toggleSidebar" }),
    },
    {
      id: "view.toggleInspector",
      label: "Toggle Inspector",
      group: "View",
      keywords: ["properties", "outline"],
      run: () => dispatch({ type: "toggleInspector" }),
    },
    {
      id: "view.focusMode",
      label: "Focus Mode",
      group: "View",
      keywords: ["zen"],
      run: () => dispatch({ type: "toggleFocusMode" }),
    },
    {
      id: "view.typewriterMode",
      label: "Typewriter Mode",
      group: "View",
      keywords: ["writing"],
      run: () => dispatch({ type: "toggleTypewriterMode" }),
    },
    {
      id: "go.outline",
      label: "Show Outline",
      group: "Navigate",
      keywords: ["toc", "headings"],
      run: () => dispatch({ type: "showInspectorTab", tab: "outline" }),
    },
    {
      id: "view.write",
      label: "Write Mode",
      group: "View",
      keywords: ["editor", "writing"],
      run: () => dispatch({ type: "setViewMode", viewMode: "write" }),
    },
    {
      id: "view.preview",
      label: "Preview Mode",
      group: "View",
      keywords: ["render", "reader"],
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
    group: "Inspector",
    keywords,
    run: () => dispatch({ type: "showInspectorTab", tab }),
  };
}

import type { WriterCommand } from "../../domain/engine";
import type { InspectorTab, WorkbenchAction } from "./workbench-state";

export interface WorkbenchCommandOptions {
  dispatch: (action: WorkbenchAction) => void;
  openDocumentSearch: () => void;
  openCommandPalette: () => void;
  openQuickOpen: () => void;
  showWorkspaceDiagnostics?: () => void;
}

export function createWorkbenchCommands({
  dispatch,
  openDocumentSearch,
  openCommandPalette,
  openQuickOpen,
  showWorkspaceDiagnostics,
}: WorkbenchCommandOptions): WriterCommand[] {
  return [
    {
      id: "document.search",
      label: "Find in Document",
      group: "Edit",
      keywords: ["search", "find", "current file"],
      shortcut: "⌘F",
      scope: "edit",
      surfaces: ["palette", "menu"],
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
      surfaces: ["palette", "menu"],
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
      surfaces: ["palette", "menu"],
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
      surfaces: ["palette", "menu"],
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
      surfaces: ["palette", "menu"],
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
      surfaces: ["palette", "menu"],
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
      surfaces: ["palette", "menu"],
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
      surfaces: ["palette", "menu"],
      priority: 40,
      run: () => dispatch({ type: "showInspectorTab", tab: "outline" }),
    },
    {
      id: "view.write",
      label: "Write Mode",
      group: "View",
      keywords: ["editor", "writing"],
      scope: "view",
      surfaces: ["palette", "menu"],
      priority: 35,
      run: () => dispatch({ type: "setViewMode", viewMode: "write" }),
    },
    {
      id: "view.preview",
      label: "Preview Mode",
      group: "View",
      keywords: ["render", "reader"],
      scope: "view",
      surfaces: ["palette", "menu"],
      priority: 34,
      run: () => dispatch({ type: "setViewMode", viewMode: "preview" }),
    },
    {
      id: "view.source",
      label: "Toggle Source Mode",
      group: "View",
      keywords: ["markdown", "frontmatter", "raw", "rich text"],
      scope: "view",
      surfaces: ["palette", "menu"],
      priority: 33,
      run: () => dispatch({ type: "toggleEditorMode" }),
    },
    {
      id: "view.richText",
      label: "Rich Text Mode",
      group: "View",
      keywords: ["wysiwyg", "editor", "formatted"],
      scope: "view",
      surfaces: ["palette"],
      priority: 33,
      run: () => dispatch({ type: "setEditorMode", editorMode: "rich-text" }),
    },
    {
      id: "workspace.showDiagnostics",
      label: "Show Workspace Diagnostics",
      group: "Workspace",
      keywords: ["plugins", "extensions", "diagnostics"],
      scope: "view",
      surfaces: ["palette"],
      priority: 32,
      run:
        showWorkspaceDiagnostics ??
        (() => dispatch({ type: "showInspectorTab", tab: "properties" })),
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
      "inspector.showReview",
      "Show AI Review",
      "review",
      ["ai", "review", "issues"],
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
    surfaces: ["palette", "menu"],
    priority: 20,
    run: () => dispatch({ type: "showInspectorTab", tab }),
  };
}

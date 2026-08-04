import type { Tab } from "@/hooks/use-tabs";

export type CommandPaletteCommand = {
  id: string;
  label: string;
  description: string;
  run: () => void;
};

interface CreateCommandPaletteCommandsInput {
  root: string | null;
  isCompactFileMode: boolean;
  activeFilePath: string | null;
  activeTabId: string | null;
  tabs: Tab[];
  toggleSidebar: () => void;
  openCreateFileIntent: () => void;
  openFileInCompactWindow: (path: string) => void;
  closeActiveTab: () => void;
  closeTab: (tabId: string) => void;
  openWorkspace: () => void;
  closeWorkspace: () => void;
  toggleTheme: () => void;
  closePalette: () => void;
}

type CommandPaletteCommandContext = CreateCommandPaletteCommandsInput;

interface CommandPaletteCommandDefinition {
  id: string;
  label: string | ((context: CommandPaletteCommandContext) => string);
  description: string;
  isVisible?: (context: CommandPaletteCommandContext) => boolean;
  run: (context: CommandPaletteCommandContext) => void;
}

export const COMMAND_PALETTE_COMMANDS: readonly CommandPaletteCommandDefinition[] = [
  {
    id: "toggle-sidebar",
    label: "Toggle Sidebar",
    description: "Command",
    isVisible: ({ root, isCompactFileMode }) => Boolean(root) && !isCompactFileMode,
    run: ({ toggleSidebar, closePalette }) => {
      toggleSidebar();
      closePalette();
    },
  },
  {
    id: "new-file",
    label: "Create New File",
    description: "Command",
    isVisible: ({ root, isCompactFileMode, activeFilePath }) =>
      Boolean(root || (isCompactFileMode && activeFilePath)),
    run: ({ openCreateFileIntent }) => openCreateFileIntent(),
  },
  {
    id: "open-in-compact-window",
    label: "Open File in Compact Window",
    description: "Command",
    isVisible: ({ root, activeFilePath }) => Boolean(root && activeFilePath),
    run: ({ activeFilePath, openFileInCompactWindow, closePalette }) => {
      if (activeFilePath) openFileInCompactWindow(activeFilePath);
      closePalette();
    },
  },
  {
    id: "close-tab",
    label: "Close Current Tab",
    description: "Command",
    isVisible: ({ activeTabId, isCompactFileMode }) => Boolean(activeTabId) && !isCompactFileMode,
    run: ({ closeActiveTab, closePalette }) => {
      closeActiveTab();
      closePalette();
    },
  },
  {
    id: "close-all",
    label: "Close All Tabs",
    description: "Command",
    isVisible: ({ tabs, isCompactFileMode }) => tabs.length > 0 && !isCompactFileMode,
    run: ({ tabs, closeTab, closePalette }) => {
      for (const tab of tabs) closeTab(tab.id);
      closePalette();
    },
  },
  {
    id: "open-workspace",
    label: "Open Workspace",
    description: "Command",
    run: ({ openWorkspace }) => openWorkspace(),
  },
  {
    id: "close-workspace",
    label: "Close Workspace",
    description: "Command",
    isVisible: ({ root }) => Boolean(root),
    run: ({ closeWorkspace, closePalette }) => {
      closeWorkspace();
      closePalette();
    },
  },
  {
    id: "toggle-theme",
    label: "Toggle Dark Mode",
    description: "Command",
    run: ({ toggleTheme, closePalette }) => {
      toggleTheme();
      closePalette();
    },
  },
];

export function createCommandPaletteCommands(
  context: CreateCommandPaletteCommandsInput,
): CommandPaletteCommand[] {
  return COMMAND_PALETTE_COMMANDS.filter((definition) =>
    definition.isVisible ? definition.isVisible(context) : true,
  ).map((definition) => ({
    id: definition.id,
    label: typeof definition.label === "function" ? definition.label(context) : definition.label,
    description: definition.description,
    run: () => definition.run(context),
  }));
}

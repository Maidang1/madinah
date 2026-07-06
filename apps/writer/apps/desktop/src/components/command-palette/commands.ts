import { settingsKind } from "@/components/editor-area/page-kinds/settings";
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
  isDocumentInspectorOpen: boolean;
  toggleSidebar: () => void;
  openCreateFileIntent: () => void;
  openFileInCompactWindow: (path: string) => void;
  toggleDocumentInspector: () => void;
  closeActiveTab: () => void;
  closeTab: (tabId: string) => void;
  openWorkspace: () => void;
  closeWorkspace: () => void;
  toggleTheme: () => void;
  openSettings: () => void;
  closePalette: () => void;
}

export function createCommandPaletteCommands({
  root,
  isCompactFileMode,
  activeFilePath,
  activeTabId,
  tabs,
  isDocumentInspectorOpen,
  toggleSidebar,
  openCreateFileIntent,
  openFileInCompactWindow,
  toggleDocumentInspector,
  closeActiveTab,
  closeTab,
  openWorkspace,
  closeWorkspace,
  toggleTheme,
  openSettings,
  closePalette,
}: CreateCommandPaletteCommandsInput): CommandPaletteCommand[] {
  return [
    root &&
      !isCompactFileMode && {
        id: "toggle-sidebar",
        label: "Toggle Sidebar",
        description: "Command",
        run: () => {
          toggleSidebar();
          closePalette();
        },
      },
    (root || (isCompactFileMode && activeFilePath)) && {
      id: "new-file",
      label: "Create New File",
      description: "Command",
      run: openCreateFileIntent,
    },
    root &&
      activeFilePath && {
        id: "open-in-compact-window",
        label: "Open File in Compact Window",
        description: "Command",
        run: () => {
          openFileInCompactWindow(activeFilePath);
          closePalette();
        },
      },
    activeFilePath && {
      id: "toggle-properties",
      label: isDocumentInspectorOpen ? "Hide Properties" : "Show Properties",
      description: "Command",
      run: () => {
        toggleDocumentInspector();
        closePalette();
      },
    },
    activeTabId &&
      !isCompactFileMode && {
        id: "close-tab",
        label: "Close Current Tab",
        description: "Command",
        run: () => {
          closeActiveTab();
          closePalette();
        },
      },
    tabs.length > 0 &&
      !isCompactFileMode && {
        id: "close-all",
        label: "Close All Tabs",
        description: "Command",
        run: () => {
          for (const tab of tabs) closeTab(tab.id);
          closePalette();
        },
      },
    {
      id: "open-workspace",
      label: "Open Workspace",
      description: "Command",
      run: openWorkspace,
    },
    root && {
      id: "close-workspace",
      label: "Close Workspace",
      description: "Command",
      run: () => {
        closeWorkspace();
        closePalette();
      },
    },
    {
      id: "toggle-theme",
      label: "Toggle Dark Mode",
      description: "Command",
      run: () => {
        toggleTheme();
        closePalette();
      },
    },
    !isCompactFileMode && {
      id: "open-settings",
      label: "Settings",
      description: settingsKind.description,
      run: () => {
        openSettings();
        closePalette();
      },
    },
  ].filter((command): command is CommandPaletteCommand => Boolean(command));
}

export type WriterViewMode = "write" | "preview";

export type WriterEditorMode = "rich-text" | "source";

export type InspectorTab =
  | "outline"
  | "properties"
  | "stats"
  | "history"
  | "review";

export interface WorkbenchState {
  viewMode: WriterViewMode;
  editorMode: WriterEditorMode;
  inspectorTab: InspectorTab;
  isSidebarVisible: boolean;
  isInspectorVisible: boolean;
  isFocusMode: boolean;
  isTypewriterMode: boolean;
}

export type WorkbenchAction =
  | { type: "setViewMode"; viewMode: WriterViewMode }
  | { type: "setEditorMode"; editorMode: WriterEditorMode }
  | { type: "toggleEditorMode" }
  | { type: "showInspectorTab"; tab: InspectorTab }
  | { type: "toggleSidebar" }
  | { type: "toggleInspector" }
  | { type: "toggleFocusMode" }
  | { type: "toggleTypewriterMode" };

export interface WorkbenchStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export type PersistedWorkbenchState = Pick<
  WorkbenchState,
  "viewMode" | "inspectorTab"
>;

export const WORKBENCH_VIEW_MODE_STORAGE_KEY = "madinah-writer-view-mode";
export const WORKBENCH_INSPECTOR_TAB_STORAGE_KEY =
  "madinah-writer-inspector-tab";

export const DEFAULT_WORKBENCH_STATE: WorkbenchState = {
  viewMode: "write",
  editorMode: "rich-text",
  inspectorTab: "outline",
  isSidebarVisible: true,
  isInspectorVisible: false,
  isFocusMode: false,
  isTypewriterMode: false,
};

export function getInitialWorkbenchState(
  storage?: WorkbenchStorage | null,
): WorkbenchState {
  return {
    ...DEFAULT_WORKBENCH_STATE,
    viewMode: readWriterViewMode(storage),
    inspectorTab: readInspectorTab(storage),
  };
}

export function persistWorkbenchState(
  state: PersistedWorkbenchState,
  storage?: WorkbenchStorage | null,
): void {
  if (!storage) return;

  try {
    storage.setItem(WORKBENCH_VIEW_MODE_STORAGE_KEY, state.viewMode);
    storage.setItem(WORKBENCH_INSPECTOR_TAB_STORAGE_KEY, state.inspectorTab);
  } catch {
    // localStorage can fail in restricted browser contexts.
  }
}

export function workbenchStateReducer(
  state: WorkbenchState,
  action: WorkbenchAction,
): WorkbenchState {
  switch (action.type) {
    case "setViewMode":
      return {
        ...state,
        viewMode: action.viewMode,
        editorMode: action.viewMode === "write" ? "rich-text" : state.editorMode,
      };
    case "setEditorMode":
      return {
        ...state,
        viewMode: "write",
        editorMode: action.editorMode,
      };
    case "toggleEditorMode":
      return {
        ...state,
        viewMode: "write",
        editorMode: state.editorMode === "source" ? "rich-text" : "source",
      };
    case "showInspectorTab":
      return {
        ...state,
        inspectorTab: action.tab,
        isInspectorVisible: true,
      };
    case "toggleSidebar":
      return { ...state, isSidebarVisible: !state.isSidebarVisible };
    case "toggleInspector":
      return { ...state, isInspectorVisible: !state.isInspectorVisible };
    case "toggleFocusMode":
      return { ...state, isFocusMode: !state.isFocusMode };
    case "toggleTypewriterMode":
      return { ...state, isTypewriterMode: !state.isTypewriterMode };
  }
}

export function shouldRestoreEditorFocus(
  previousViewMode: WriterViewMode,
  nextViewMode: WriterViewMode,
): boolean {
  return previousViewMode === "preview" && nextViewMode === "write";
}

function readWriterViewMode(storage?: WorkbenchStorage | null): WriterViewMode {
  const value = readStorageValue(storage, WORKBENCH_VIEW_MODE_STORAGE_KEY);
  return value === "preview" ? "preview" : "write";
}

function readInspectorTab(storage?: WorkbenchStorage | null): InspectorTab {
  const value = readStorageValue(storage, WORKBENCH_INSPECTOR_TAB_STORAGE_KEY);

  if (
    value === "properties" ||
    value === "stats" ||
    value === "history" ||
    value === "review"
  ) {
    return value;
  }

  return "outline";
}

function readStorageValue(
  storage: WorkbenchStorage | null | undefined,
  key: string,
): string | null {
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

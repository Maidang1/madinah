import type { DocumentSession } from "../session/document-session";

export type WriterViewMode = "write" | "preview";

export type WriterEditorMode = "rich-text" | "source";

export type InspectorTab = "outline" | "properties" | "stats" | "history";

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

export type SaveSemanticState =
  | "edited"
  | "draft-saved"
  | "file-saved"
  | "app-saved"
  | "saving"
  | "opening"
  | "creating"
  | "error";

export type SavePresentationIcon =
  | "pencil"
  | "file-clock"
  | "file-check"
  | "check"
  | "loader"
  | "alert";

export interface SavePresentation {
  state: SaveSemanticState;
  label: string;
  tooltip: string;
  icon: SavePresentationIcon;
  tone: "edited" | "draft" | "saved" | "busy" | "error";
  isBusy: boolean;
}

export function getSavePresentation(
  session: DocumentSession,
  status: string,
): SavePresentation {
  if (session.draftStatus === "error" || session.error) {
    const error = session.error || status;
    return {
      state: "error",
      label: "Save failed",
      tooltip: error ? `Save failed: ${error}` : "Save failed",
      icon: "alert",
      tone: "error",
      isBusy: false,
    };
  }

  if (session.draftStatus === "saving" || status === "Saving") {
    return {
      state: "saving",
      label: "Saving",
      tooltip: "Saving",
      icon: "loader",
      tone: "busy",
      isBusy: true,
    };
  }

  if (status === "Opening") {
    return {
      state: "opening",
      label: "Opening",
      tooltip: "Opening",
      icon: "loader",
      tone: "busy",
      isBusy: true,
    };
  }

  if (status === "Creating") {
    return {
      state: "creating",
      label: "Creating",
      tooltip: "Creating",
      icon: "loader",
      tone: "busy",
      isBusy: true,
    };
  }

  if (
    session.filePath &&
    session.isDirty &&
    session.draftStatus === "saved"
  ) {
    return {
      state: "draft-saved",
      label: "Recovery draft saved",
      tooltip: "Recovery draft saved",
      icon: "file-clock",
      tone: "draft",
      isBusy: false,
    };
  }

  if (session.isDirty) {
    return {
      state: "edited",
      label: "Edited",
      tooltip: "Edited",
      icon: "pencil",
      tone: "edited",
      isBusy: false,
    };
  }

  if (session.filePath) {
    return {
      state: "file-saved",
      label: "Saved to file",
      tooltip: "Saved to file",
      icon: "file-check",
      tone: "saved",
      isBusy: false,
    };
  }

  return {
    state: "app-saved",
    label: "Saved",
    tooltip: "Saved",
    icon: "check",
    tone: "saved",
    isBusy: false,
  };
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
    value === "history"
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

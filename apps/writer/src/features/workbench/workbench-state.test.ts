import { describe, expect, it } from "vitest";
import {
  getInitialWorkbenchState,
  persistWorkbenchState,
  shouldRestoreEditorFocus,
  workbenchStateReducer,
  type WorkbenchStorage,
} from "./workbench-state";

describe("workbench state", () => {
  it("loads persisted view mode and inspector tab with stable defaults", () => {
    const storage = createStorage({
      "madinah-writer-view-mode": "preview",
      "madinah-writer-inspector-tab": "history",
    });

    expect(getInitialWorkbenchState(storage)).toEqual({
      viewMode: "preview",
      editorMode: "rich-text",
      inspectorTab: "history",
      isSidebarVisible: true,
      isInspectorVisible: false,
      isFocusMode: false,
      isTypewriterMode: false,
    });
  });

  it("ignores invalid persisted workbench values", () => {
    const storage = createStorage({
      "madinah-writer-view-mode": "source",
      "madinah-writer-inspector-tab": "metadata",
    });

    expect(getInitialWorkbenchState(storage)).toMatchObject({
      viewMode: "write",
      editorMode: "rich-text",
      inspectorTab: "outline",
    });
  });

  it("persists view mode and inspector tab", () => {
    const storage = createStorage();

    persistWorkbenchState(
      {
        ...getInitialWorkbenchState(storage),
        viewMode: "preview",
        inspectorTab: "stats",
      },
      storage,
    );

    expect(storage.getItem("madinah-writer-view-mode")).toBe("preview");
    expect(storage.getItem("madinah-writer-inspector-tab")).toBe("stats");
  });

  it("updates layout, view mode, and inspector tab through reducer actions", () => {
    let state = getInitialWorkbenchState(createStorage());

    state = workbenchStateReducer(state, { type: "toggleSidebar" });
    state = workbenchStateReducer(state, { type: "toggleInspector" });
    state = workbenchStateReducer(state, { type: "toggleFocusMode" });
    state = workbenchStateReducer(state, { type: "toggleTypewriterMode" });
    state = workbenchStateReducer(state, {
      type: "setViewMode",
      viewMode: "preview",
    });
    state = workbenchStateReducer(state, {
      type: "setEditorMode",
      editorMode: "source",
    });
    state = workbenchStateReducer(state, {
      type: "showInspectorTab",
      tab: "properties",
    });

    expect(state).toEqual({
      editorMode: "source",
      viewMode: "write",
      inspectorTab: "properties",
      isSidebarVisible: false,
      isInspectorVisible: true,
      isFocusMode: true,
      isTypewriterMode: true,
    });
  });

  it("restores editor focus only when returning from preview to write", () => {
    expect(shouldRestoreEditorFocus("preview", "write")).toBe(true);
    expect(shouldRestoreEditorFocus("write", "preview")).toBe(false);
    expect(shouldRestoreEditorFocus("write", "write")).toBe(false);
  });
});

function createStorage(initial: Record<string, string> = {}): WorkbenchStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

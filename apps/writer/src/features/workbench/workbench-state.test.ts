import { describe, expect, it } from "vitest";
import type { MarkdownDocument } from "../../domain/document";
import type { DocumentSession } from "../session/document-session";
import {
  createDocumentSession,
  documentSessionReducer,
} from "../session/document-session";
import {
  getInitialWorkbenchState,
  getSavePresentation,
  persistWorkbenchState,
  workbenchStateReducer,
  type WorkbenchStorage,
} from "./workbench-state";

describe("save presentation", () => {
  it("shows edited state for dirty file changes before a recovery draft is saved", () => {
    const session = changeFileSource(openFileSession());

    expect(getSavePresentation(session, "Unsaved changes")).toMatchObject({
      state: "edited",
      label: "Edited",
      tooltip: "Edited",
      icon: "pencil",
      tone: "edited",
      isBusy: false,
    });
  });

  it("shows recovery draft state for dirty file changes after draft save", () => {
    const changed = changeFileSource(openFileSession());
    const session = documentSessionReducer(changed, {
      type: "draftSaved",
      draftPath: "/tmp/project/original.md",
    });

    expect(getSavePresentation(session, "Draft saved")).toMatchObject({
      state: "draft-saved",
      label: "Recovery draft saved",
      tooltip: "Recovery draft saved",
      icon: "file-clock",
      tone: "draft",
      isBusy: false,
    });
  });

  it("distinguishes file saves from app document saves", () => {
    expect(getSavePresentation(openFileSession(), "Ready")).toMatchObject({
      state: "file-saved",
      label: "Saved to file",
      tooltip: "Saved to file",
      icon: "file-check",
      tone: "saved",
    });
    expect(getSavePresentation(openAppDocumentSession(), "Saved")).toMatchObject({
      state: "app-saved",
      label: "Saved",
      tooltip: "Saved",
      icon: "check",
      tone: "saved",
    });
  });

  it("shows busy and error states ahead of saved states", () => {
    const savingSession = documentSessionReducer(changeFileSource(openFileSession()), {
      type: "saveStarted",
    });
    const failedSession = documentSessionReducer(savingSession, {
      type: "saveFailed",
      error: "disk full",
    });

    expect(getSavePresentation(savingSession, "Saving")).toMatchObject({
      state: "saving",
      label: "Saving",
      tooltip: "Saving",
      icon: "loader",
      tone: "busy",
      isBusy: true,
    });
    expect(getSavePresentation(failedSession, "disk full")).toMatchObject({
      state: "error",
      label: "Save failed",
      tooltip: "Save failed: disk full",
      icon: "alert",
      tone: "error",
      isBusy: false,
    });
  });

  it("shows document lifecycle busy states", () => {
    const session = createDocumentSession();

    expect(getSavePresentation(session, "Opening")).toMatchObject({
      state: "opening",
      label: "Opening",
      tooltip: "Opening",
      icon: "loader",
      tone: "busy",
      isBusy: true,
    });
    expect(getSavePresentation(session, "Creating")).toMatchObject({
      state: "creating",
      label: "Creating",
      tooltip: "Creating",
      icon: "loader",
      tone: "busy",
      isBusy: true,
    });
  });
});

describe("workbench state", () => {
  it("loads persisted view mode and inspector tab with stable defaults", () => {
    const storage = createStorage({
      "madinah-writer-view-mode": "preview",
      "madinah-writer-inspector-tab": "history",
    });

    expect(getInitialWorkbenchState(storage)).toEqual({
      viewMode: "preview",
      inspectorTab: "history",
      isSidebarVisible: true,
      isInspectorVisible: true,
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
      type: "showInspectorTab",
      tab: "properties",
    });

    expect(state).toEqual({
      viewMode: "preview",
      inspectorTab: "properties",
      isSidebarVisible: false,
      isInspectorVisible: true,
      isFocusMode: true,
      isTypewriterMode: true,
    });
  });
});

function openFileSession(): DocumentSession {
  return documentSessionReducer(createDocumentSession(), {
    type: "openSucceeded",
    document: documentFixture,
    workspace: { root: "/tmp/project", profile: "gfm", plugins: [] },
    filePath: "/tmp/project/original.md",
  });
}

function openAppDocumentSession(): DocumentSession {
  return documentSessionReducer(createDocumentSession(), {
    type: "openSucceeded",
    document: documentFixture,
    workspace: { root: "browser://local-documents", profile: "gfm", plugins: [] },
  });
}

function changeFileSource(session: DocumentSession): DocumentSession {
  return documentSessionReducer(session, {
    type: "changeSource",
    source: "# Updated\n\nBody",
    timestamp: "2026-06-29T12:00:00.000Z",
  });
}

const documentFixture: MarkdownDocument = {
  id: "doc-1",
  slug: "original",
  title: "Original",
  description: "",
  author: "Madinah",
  tags: [],
  status: "draft",
  pubDate: "2026-06-29 10:00:00",
  body: "# Original",
  createdAt: "2026-06-29T10:00:00.000Z",
  updatedAt: "2026-06-29T10:00:00.000Z",
};

function createStorage(initial: Record<string, string> = {}): WorkbenchStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

import { describe, expect, it } from "vitest";
import type { MarkdownDocument } from "../../domain/document";
import {
  createDocumentSession,
  documentSessionReducer,
} from "./document-session";

describe("document session reducer", () => {
  it("opens a document as a clean session", () => {
    const session = documentSessionReducer(createDocumentSession(), {
      type: "openSucceeded",
      document: documentFixture,
      workspace: {
        root: "/tmp/project",
        profile: "gfm",
        plugins: ["./plugins/callouts"],
      },
    });

    expect(session.document?.id).toBe("doc-1");
    expect(session.lastSavedDocument?.id).toBe("doc-1");
    expect(session.workspace?.root).toBe("/tmp/project");
    expect(session.isDirty).toBe(false);
  });

  it("tracks source changes and clears dirty state after save", () => {
    const opened = documentSessionReducer(createDocumentSession(), {
      type: "openSucceeded",
      document: documentFixture,
      workspace: { root: "/tmp/project", profile: "gfm", plugins: [] },
    });

    const changed = documentSessionReducer(opened, {
      type: "changeSource",
      source: "# Updated\n\nBody",
      timestamp: "2026-06-27T12:00:00.000Z",
    });

    expect(changed.document?.body).toBe("# Updated\n\nBody");
    expect(changed.document?.updatedAt).toBe("2026-06-27T12:00:00.000Z");
    expect(changed.isDirty).toBe(true);

    const saved = documentSessionReducer(changed, {
      type: "saveSucceeded",
      document: changed.document!,
    });

    expect(saved.isDirty).toBe(false);
    expect(saved.lastSavedDocument?.body).toBe("# Updated\n\nBody");
  });

  it("tracks metadata changes as dirty document edits", () => {
    const opened = documentSessionReducer(createDocumentSession(), {
      type: "openSucceeded",
      document: documentFixture,
      workspace: { root: "/tmp/project", profile: "gfm", plugins: [] },
    });

    const changed = documentSessionReducer(opened, {
      type: "changeMetadata",
      patch: {
        title: "Updated title",
        tags: "writing, notes, writing",
        status: "WIP",
      },
      timestamp: "2026-06-27T12:00:00.000Z",
    });

    expect(changed.document).toMatchObject({
      title: "Updated title",
      tags: ["writing", "notes"],
      status: "WIP",
      updatedAt: "2026-06-27T12:00:00.000Z",
    });
    expect(changed.isDirty).toBe(true);
  });

  it("restores a previous document version as a dirty edit", () => {
    const opened = documentSessionReducer(createDocumentSession(), {
      type: "openSucceeded",
      document: documentFixture,
      workspace: { root: "/tmp/project", profile: "gfm", plugins: [] },
    });

    const restored = documentSessionReducer(opened, {
      type: "restoreDocument",
      document: {
        ...documentFixture,
        title: "Restored",
        body: "# Restored",
      },
      timestamp: "2026-06-27T12:30:00.000Z",
    });

    expect(restored.document?.title).toBe("Restored");
    expect(restored.document?.body).toBe("# Restored");
    expect(restored.document?.updatedAt).toBe("2026-06-27T12:30:00.000Z");
    expect(restored.isDirty).toBe(true);
    expect(restored.lastSavedDocument?.title).toBe("Original");
  });

  it("reverts to the last saved document", () => {
    const opened = documentSessionReducer(createDocumentSession(), {
      type: "openSucceeded",
      document: documentFixture,
      workspace: { root: "/tmp/project", profile: "gfm", plugins: [] },
    });
    const changed = documentSessionReducer(opened, {
      type: "changeSource",
      source: "# Draft",
      timestamp: "2026-06-27T12:00:00.000Z",
    });

    const reverted = documentSessionReducer(changed, { type: "revert" });

    expect(reverted.document?.body).toBe("# Original");
    expect(reverted.isDirty).toBe(false);
  });

  it("keeps file sessions on the same path after direct saves", () => {
    const opened = documentSessionReducer(createDocumentSession(), {
      type: "openSucceeded",
      document: documentFixture,
      workspace: { root: "/tmp/project", profile: "gfm", plugins: [] },
      filePath: "/tmp/project/original.md",
    });

    const changed = documentSessionReducer(opened, {
      type: "changeSource",
      source: "# File update",
      timestamp: "2026-06-27T12:00:00.000Z",
    });
    const saved = documentSessionReducer(changed, {
      type: "saveSucceeded",
      document: changed.document!,
    });

    expect(saved.filePath).toBe("/tmp/project/original.md");
    expect(saved.isDirty).toBe(false);
    expect(saved.lastSavedDocument?.body).toBe("# File update");
  });

  it("clears the session when close is confirmed", () => {
    const opened = documentSessionReducer(createDocumentSession(), {
      type: "openSucceeded",
      document: documentFixture,
      workspace: { root: "/tmp/project", profile: "gfm", plugins: [] },
    });
    const closed = documentSessionReducer(opened, { type: "closeConfirmed" });

    expect(closed.document).toBeNull();
  });
});

const documentFixture: MarkdownDocument = {
  id: "doc-1",
  slug: "original",
  title: "Original",
  description: "",
  author: "Madinah",
  tags: [],
  status: "draft",
  pubDate: "2026-06-27 10:00:00",
  body: "# Original",
  createdAt: "2026-06-27T10:00:00.000Z",
  updatedAt: "2026-06-27T10:00:00.000Z",
};

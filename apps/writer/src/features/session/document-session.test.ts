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

  it("tracks draft saves and save-as path transitions", () => {
    const opened = documentSessionReducer(createDocumentSession(), {
      type: "openSucceeded",
      document: documentFixture,
      workspace: { root: "/tmp/project", profile: "gfm", plugins: [] },
      filePath: "/tmp/project/original.md",
    });

    const draftSaved = documentSessionReducer(opened, {
      type: "draftSaved",
      draftPath: "/tmp/project/original.md",
    });
    const savedAs = documentSessionReducer(draftSaved, {
      type: "saveAsSucceeded",
      document: { ...documentFixture, slug: "copy" },
      filePath: "/tmp/project/copy.md",
    });

    expect(draftSaved.draftStatus).toBe("saved");
    expect(draftSaved.draftPath).toBe("/tmp/project/original.md");
    expect(savedAs.filePath).toBe("/tmp/project/copy.md");
    expect(savedAs.isDirty).toBe(false);
    expect(savedAs.lastSavedDocument?.slug).toBe("copy");
  });

  it("marks close as pending when dirty changes require confirmation", () => {
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

    const closing = documentSessionReducer(changed, { type: "closeRequested" });
    const closed = documentSessionReducer(closing, { type: "closeConfirmed" });

    expect(closing.closeState).toBe("confirming");
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

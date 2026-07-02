import { describe, expect, it } from "vitest";
import type { MarkdownDocument } from "../../domain/document";
import {
  appendDocumentVersion,
  createDocumentVersion,
  getVersionTargetId,
} from "./document-history";

describe("document history", () => {
  it("creates a restorable version from document content and metadata", () => {
    const version = createDocumentVersion({
      targetId: "doc-1",
      document: documentFixture({
        title: "Versioned",
        tags: ["note", "draft"],
        body: "# Versioned\n\nBody",
      }),
      reason: "Manual snapshot",
      now: new Date("2026-06-28T10:00:00.000Z"),
    });

    expect(version).toMatchObject({
      id: "doc-1:2026-06-28T10:00:00.000Z",
      targetId: "doc-1",
      title: "Versioned",
      tags: ["note", "draft"],
      body: "# Versioned\n\nBody",
      reason: "Manual snapshot",
      createdAt: "2026-06-28T10:00:00.000Z",
    });
  });

  it("deduplicates adjacent identical snapshots", () => {
    const document = documentFixture({ body: "# Same" });
    const first = createDocumentVersion({
      targetId: "doc-1",
      document,
      reason: "Manual snapshot",
      now: new Date("2026-06-28T10:00:00.000Z"),
    });
    const duplicate = createDocumentVersion({
      targetId: "doc-1",
      document,
      reason: "Manual snapshot",
      now: new Date("2026-06-28T10:05:00.000Z"),
    });

    expect(appendDocumentVersion([first], duplicate)).toEqual([first]);
  });

  it("keeps newest snapshots within the configured limit", () => {
    const versions = Array.from({ length: 4 }, (_, index) =>
      createDocumentVersion({
        targetId: "doc-1",
        document: documentFixture({ body: `# Version ${index}` }),
        reason: "Manual snapshot",
        now: new Date(`2026-06-28T10:0${index}:00.000Z`),
      }),
    );

    expect(
      appendDocumentVersion(versions.slice(0, 3), versions[3], 3).map(
        (version) => version.body,
      ),
    ).toEqual(["# Version 3", "# Version 2", "# Version 1"]);
  });

  it("uses file path as the history target when editing workspace files", () => {
    expect(getVersionTargetId(documentFixture({ id: "stored" }), null)).toBe(
      "stored",
    );
    expect(
      getVersionTargetId(documentFixture({ id: "stored" }), "/workspace/a.md"),
    ).toBe("/workspace/a.md");
  });
});

function documentFixture(
  overrides: Partial<MarkdownDocument> = {},
): MarkdownDocument {
  return {
    id: "doc-1",
    slug: "doc-1",
    title: "Document",
    description: "",
    author: "Madinah",
    tags: [],
    status: "draft",
    pubDate: "2026-06-27 10:00:00",
    body: "# Document",
    createdAt: "2026-06-27T10:00:00.000Z",
    updatedAt: "2026-06-27T10:00:00.000Z",
    ...overrides,
  };
}

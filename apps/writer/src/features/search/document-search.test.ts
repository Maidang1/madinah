import { describe, expect, it } from "vitest";
import type { MarkdownDocument } from "../../domain/document";
import type { FileTreeNode } from "../file-tree/file-tree";
import {
  buildQuickOpenItems,
  searchQuickOpenItems,
} from "./document-search";

describe("document search", () => {
  it("finds documents by title, tag, and body with stronger title matches first", () => {
    const items = buildQuickOpenItems({
      documents: [
        documentFixture({
          id: "doc-body",
          title: "Scratch",
          tags: ["daily"],
          body: "# Scratch\n\nPrototype review notes",
          updatedAt: "2026-06-27T09:00:00.000Z",
        }),
        documentFixture({
          id: "doc-title",
          title: "Prototype Plan",
          tags: ["planning"],
          body: "# Draft\n\nNotes",
          updatedAt: "2026-06-27T08:00:00.000Z",
        }),
        documentFixture({
          id: "doc-tag",
          title: "Meeting",
          tags: ["prototype"],
          body: "# Meeting",
          updatedAt: "2026-06-27T10:00:00.000Z",
        }),
      ],
      fileTreeNodes: [],
    });

    expect(searchQuickOpenItems(items, "prototype").map((item) => item.id)).toEqual([
      "document:doc-title",
      "document:doc-tag",
      "document:doc-body",
    ]);
  });

  it("includes markdown files from the workspace tree", () => {
    const fileTreeNodes: FileTreeNode[] = [
      {
        kind: "directory",
        name: "notes",
        path: "/workspace/notes",
        childrenCount: 1,
        children: [
          {
            kind: "file",
            name: "daily.md",
            path: "/workspace/notes/daily.md",
            childrenCount: 0,
            children: [],
          },
        ],
      },
    ];

    const items = buildQuickOpenItems({
      documents: [],
      fileTreeNodes,
      workspaceRoot: "/workspace",
    });

    expect(searchQuickOpenItems(items, "daily")).toMatchObject([
      {
        id: "file:/workspace/notes/daily.md",
        kind: "file",
        title: "daily.md",
        detail: "notes/daily.md",
        path: "/workspace/notes/daily.md",
      },
    ]);
  });

  it("returns recent documents for an empty query before file paths", () => {
    const items = buildQuickOpenItems({
      documents: [
        documentFixture({
          id: "older",
          title: "Older",
          updatedAt: "2026-06-25T08:00:00.000Z",
        }),
        documentFixture({
          id: "newer",
          title: "Newer",
          updatedAt: "2026-06-27T08:00:00.000Z",
        }),
      ],
      fileTreeNodes: [
        {
          kind: "file",
          name: "alpha.md",
          path: "/workspace/alpha.md",
          childrenCount: 0,
          children: [],
        },
      ],
      workspaceRoot: "/workspace",
    });

    expect(searchQuickOpenItems(items, "").map((item) => item.id)).toEqual([
      "document:newer",
      "document:older",
      "file:/workspace/alpha.md",
    ]);
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

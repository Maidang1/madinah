import { describe, expect, it } from "vitest";
import type { MarkdownDocument } from "../../domain/document";
import {
  buildFileTreeDraftItems,
  buildSidebarTree,
  collectFolderIds,
  formatRelativeDate,
  formatWordCount,
  getDocumentDisplayTitle,
  getDocumentFileName,
  getDocumentMetrics,
  getWritingMetricItems,
  mergeActiveDocument,
} from "./document-summary";

describe("document summary helpers", () => {
  it("merges the active document and keeps newest documents first", () => {
    const older = documentFixture({
      id: "older",
      updatedAt: "2026-06-27T09:00:00.000Z",
    });
    const active = documentFixture({
      id: "active",
      title: "Active",
      updatedAt: "2026-06-29T09:00:00.000Z",
    });

    expect(mergeActiveDocument([older], active).map((item) => item.id)).toEqual([
      "active",
      "older",
    ]);
    expect(
      mergeActiveDocument([older, active], {
        ...older,
        updatedAt: "2026-06-30T09:00:00.000Z",
      }).map((item) => item.id),
    ).toEqual(["older", "active"]);
  });

  it("uses heading titles and derives file names", () => {
    const document = documentFixture({
      title: "Fallback",
      slug: "fallback",
      body: "# Heading title\n\nBody",
    });

    expect(getDocumentDisplayTitle(document)).toBe("Heading title");
    expect(getDocumentFileName(document, null)).toBe("fallback.md");
    expect(getDocumentFileName(document, "/workspace/notes/daily.md")).toBe(
      "daily.md",
    );
  });

  it("counts writing metrics after removing frontmatter markup", () => {
    expect(
      getDocumentMetrics(
        [
          "---",
          "title: Frontmatter",
          "---",
          "# 标题",
          "",
          "Hello world and 中文。",
          "",
          "![Alt](image.png) [Link](https://example.com)",
          "",
          "```ts",
          "const value = 1;",
          "```",
        ].join("\n"),
      ),
    ).toMatchObject({
      blocks: 4,
      headings: 1,
      images: 1,
      links: 1,
      readingMinutes: 1,
      words: 8,
    });
  });

  it("builds the sidebar tree and draft list from document summaries", () => {
    const now = new Date("2026-06-29T12:00:00.000Z");
    const documents = [
      documentFixture({
        id: "yesterday",
        title: "Yesterday",
        status: "WIP",
        updatedAt: "2026-06-28T09:00:00.000Z",
      }),
      documentFixture({
        id: "today",
        title: "Today",
        status: "draft",
        updatedAt: "2026-06-29T09:00:00.000Z",
      }),
    ];
    const tree = buildSidebarTree(documents);
    const root = tree[0];

    expect(root.kind).toBe("folder");
    if (root.kind !== "folder") return;

    expect(root.children.map((node) => node.label)).toEqual([
      "2026-06-29",
      "2026-06-28",
    ]);
    expect(collectFolderIds(tree)).toEqual([
      "root",
      "folder-2026-06-29",
      "folder-2026-06-28",
    ]);
    expect(
      buildFileTreeDraftItems(documents, now).map((item) => item.detail),
    ).toEqual(["draft / 今天", "WIP / 昨天"]);
  });

  it("formats relative dates and word counts for compact chrome", () => {
    const now = new Date("2026-06-29T12:00:00.000Z");

    expect(formatRelativeDate("2026-06-29T09:00:00.000Z", now)).toBe("今天");
    expect(formatRelativeDate("2026-06-28T09:00:00.000Z", now)).toBe("昨天");
    expect(formatRelativeDate("2026-06-25T09:00:00.000Z", now)).toBe(
      "4 天前",
    );
    expect(formatWordCount(1)).toBe("1 Word");
    expect(formatWordCount(2)).toBe("2 Words");
  });

  it("builds stable writing metric cards", () => {
    const items = getWritingMetricItems({
      words: 1200,
      characters: 3500,
      blocks: 12,
      headings: 4,
      links: 3,
      images: 1,
      readingMinutes: 6,
    });

    expect(items.map((item) => [item.id, item.label, item.value])).toEqual([
      ["words", "Words", 1200],
      ["characters", "Chars", 3500],
      ["blocks", "Blocks", 12],
      ["headings", "Headings", 4],
      ["links", "Links", 3],
      ["images", "Images", 1],
      ["readingMinutes", "Read Min", 6],
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

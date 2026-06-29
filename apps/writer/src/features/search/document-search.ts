import type { MarkdownDocument } from "../../domain/document";
import type { FileTreeNode } from "../file-tree/file-tree";

export type QuickOpenItem =
  | {
      id: string;
      kind: "document";
      title: string;
      detail: string;
      documentId: string;
      updatedAt: string;
      searchText: string;
    }
  | {
      id: string;
      kind: "file";
      title: string;
      detail: string;
      path: string;
      searchText: string;
    };

interface BuildQuickOpenItemsInput {
  documents: MarkdownDocument[];
  fileTreeNodes: FileTreeNode[];
  workspaceRoot?: string | null;
}

export function buildQuickOpenItems({
  documents,
  fileTreeNodes,
  workspaceRoot,
}: BuildQuickOpenItemsInput): QuickOpenItem[] {
  return [
    ...documents.map((document) => ({
      id: `document:${document.id}`,
      kind: "document" as const,
      title: document.title || "Untitled",
      detail: [
        document.tags.length > 0 ? document.tags.join(", ") : "",
        document.status,
      ]
        .filter(Boolean)
        .join(" / "),
      documentId: document.id,
      updatedAt: document.updatedAt,
      searchText: normalizeSearchText([
        document.title,
        document.description,
        document.author,
        document.status,
        document.tags.join(" "),
        document.body,
      ]),
    })),
    ...flattenFileNodes(fileTreeNodes).map(({ node, root }) => {
      const detail = toRelativePath(root ?? workspaceRoot, node.path);
      return {
        id: `file:${node.path}`,
        kind: "file" as const,
        title: node.name,
        detail,
        path: node.path,
        searchText: normalizeSearchText([node.name, detail, node.path]),
      };
    }),
  ];
}

export function searchQuickOpenItems(
  items: QuickOpenItem[],
  query: string,
): QuickOpenItem[] {
  const normalizedQuery = normalizeSearchText([query]);
  if (!normalizedQuery) return sortEmptyQueryItems(items);

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  return items
    .map((item, index) => ({
      item,
      index,
      score: scoreItem(item, terms),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return compareRecency(a.item, b.item) || a.index - b.index;
    })
    .map((entry) => entry.item);
}

function scoreItem(item: QuickOpenItem, terms: string[]): number {
  if (!terms.every((term) => item.searchText.includes(term))) return 0;

  const title = normalizeSearchText([item.title]);
  const detail = normalizeSearchText([item.detail]);
  const titleScore = terms.reduce((score, term) => {
    if (title.startsWith(term)) return score + 120;
    if (title.includes(term)) return score + 100;
    return score;
  }, 0);
  const detailScore = terms.reduce(
    (score, term) => score + (detail.includes(term) ? 45 : 0),
    0,
  );

  if (item.kind === "document") {
    const metadata = normalizeSearchText([item.detail]);
    const metadataScore = terms.reduce(
      (score, term) => score + (metadata.includes(term) ? 70 : 0),
      0,
    );
    return titleScore + metadataScore + detailScore + 10;
  }

  return titleScore + detailScore + 30;
}

function sortEmptyQueryItems(items: QuickOpenItem[]): QuickOpenItem[] {
  return [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "document" ? -1 : 1;
    return compareRecency(a, b) || a.title.localeCompare(b.title);
  });
}

function compareRecency(left: QuickOpenItem, right: QuickOpenItem): number {
  if (left.kind === "document" && right.kind === "document") {
    return right.updatedAt.localeCompare(left.updatedAt);
  }

  if (left.kind === "document") return -1;
  if (right.kind === "document") return 1;

  return left.detail.localeCompare(right.detail);
}

function flattenFileNodes(
  nodes: FileTreeNode[],
  root: string | null = null,
): Array<{ node: FileTreeNode; root: string | null }> {
  return nodes.flatMap((node) =>
    node.kind === "file"
      ? [{ node, root }]
      : flattenFileNodes(node.children, node.isRoot ? node.path : root),
  );
}

function normalizeSearchText(values: string[]): string {
  return values.join(" ").toLowerCase().replace(/\s+/g, " ").trim();
}

function toRelativePath(root: string | null | undefined, path: string): string {
  if (!root) return path;
  for (const separator of ["/", "\\"]) {
    const prefix = `${root}${separator}`;
    if (path.startsWith(prefix)) return path.slice(prefix.length);
  }
  return path;
}

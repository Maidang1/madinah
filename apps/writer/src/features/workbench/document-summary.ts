import {
  extractDocumentTitle,
  type DocumentStatus,
  type MarkdownDocument,
} from "../../domain/document";
import type { FileTreeDraftItem } from "../file-tree/file-tree";

export const DOCUMENT_STATUSES = [
  "draft",
  "WIP",
  "published",
  "archived",
] satisfies DocumentStatus[];

export type SidebarTreeNode =
  | {
      id: string;
      kind: "folder";
      label: string;
      children: SidebarTreeNode[];
    }
  | {
      id: string;
      kind: "document";
      label: string;
      detail: string;
      document: MarkdownDocument;
    };

export interface DocumentMetrics {
  characters: number;
  blocks: number;
  headings: number;
  images: number;
  links: number;
  readingMinutes: number;
  words: number;
}

export interface WritingMetricItem {
  id: keyof DocumentMetrics;
  label: string;
  value: number;
}

const WRITING_METRIC_DEFINITIONS: Array<{
  id: keyof DocumentMetrics;
  label: string;
}> = [
  { id: "words", label: "Words" },
  { id: "characters", label: "Chars" },
  { id: "blocks", label: "Blocks" },
  { id: "headings", label: "Headings" },
  { id: "links", label: "Links" },
  { id: "images", label: "Images" },
  { id: "readingMinutes", label: "Read Min" },
];

export function mergeActiveDocument(
  documents: MarkdownDocument[],
  document: MarkdownDocument | null,
): MarkdownDocument[] {
  if (!document) return documents;

  return sortDocuments(
    documents.some((item) => item.id === document.id)
      ? documents.map((item) => (item.id === document.id ? document : item))
      : [...documents, document],
  );
}

export function sortDocuments(
  documents: MarkdownDocument[],
): MarkdownDocument[] {
  return [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDocumentDisplayTitle(document: MarkdownDocument): string {
  const heading = extractDocumentTitle(document.body);
  if (heading && heading !== "Untitled") return heading;

  return document.title || "Untitled";
}

export function getDocumentFileName(
  document: MarkdownDocument,
  filePath: string | null,
): string {
  if (filePath) {
    return filePath.split(/[\\/]/).pop() || `${document.slug}.md`;
  }

  return `${document.slug || "untitled"}.md`;
}

export function getDocumentMetrics(source: string): DocumentMetrics {
  const content = stripFrontmatter(source);
  const images = content.match(/!\[[^\]]*]\([^)]+\)/g)?.length ?? 0;
  const links = content.match(/(?<!!)\[[^\]]+]\([^)]+\)/g)?.length ?? 0;
  const headings = content.match(/^#{1,6}\s+.+$/gm)?.length ?? 0;
  const readableText = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^[#>\s-]+/gm, "")
    .replace(/[>*_~`[\](){}|\\-]/g, " ")
    .replace(/\s+/g, "");
  const wordText = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^[#>\s-]+/gm, " ");
  const words =
    wordText.match(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[\p{Letter}\p{Number}]+(?:['’-][\p{Letter}\p{Number}]+)*/gu,
    )?.length ?? 0;
  const blocks = content
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean).length;

  return {
    characters: readableText.length,
    blocks,
    headings,
    images,
    links,
    readingMinutes: Math.max(1, Math.ceil(words / 220)),
    words,
  };
}

export function buildSidebarTree(
  documents: MarkdownDocument[],
): SidebarTreeNode[] {
  const grouped = new Map<string, MarkdownDocument[]>();

  for (const document of documents) {
    const group = formatTreeDate(document.updatedAt);
    grouped.set(group, [...(grouped.get(group) ?? []), document]);
  }

  const children = [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, items]) => ({
      id: `folder-${date}`,
      kind: "folder" as const,
      label: date,
      children: sortDocuments(items).map((document) => ({
        id: document.id,
        kind: "document" as const,
        label: getDocumentDisplayTitle(document),
        detail: getDocumentFileName(document, null),
        document,
      })),
    }));

  return [
    {
      id: "root",
      kind: "folder",
      label: "Codex",
      children,
    },
  ];
}

export function buildFileTreeDraftItems(
  documents: MarkdownDocument[],
  now = new Date(),
): FileTreeDraftItem[] {
  return sortDocuments(documents).map((document) => ({
    id: document.id,
    title: getDocumentDisplayTitle(document),
    status: document.status,
    detail: [document.status, formatRelativeDate(document.updatedAt, now)]
      .filter(Boolean)
      .join(" / "),
  }));
}

export function collectFolderIds(nodes: SidebarTreeNode[]): string[] {
  return nodes.flatMap((node) => {
    if (node.kind === "document") return [];
    return [node.id, ...collectFolderIds(node.children)];
  });
}

export function getWritingMetricItems(
  metrics: DocumentMetrics,
): WritingMetricItem[] {
  return WRITING_METRIC_DEFINITIONS.map((definition) => ({
    ...definition,
    value: metrics[definition.id],
  }));
}

export function formatMetric(value: number): string {
  return new Intl.NumberFormat(undefined).format(value);
}

export function formatVersionTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatWordCount(words: number): string {
  return `${words} ${words === 1 ? "Word" : "Words"}`;
}

export function formatRelativeDate(value: string, now = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "今天";

  const today = startOfDay(now).getTime();
  const target = startOfDay(date).getTime();
  const days = Math.max(0, Math.round((today - target) / 86_400_000));

  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  if (days < 14) return "上周";

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function stripFrontmatter(source: string): string {
  return source.replace(/^---[\s\S]*?\n---\s*/u, "");
}

function formatTreeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Drafts";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

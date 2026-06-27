export type DocumentStatus = "draft" | "published" | "archived" | "WIP";

export interface MarkdownDocument {
  id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  tags: string[];
  status: DocumentStatus;
  pubDate: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export type WriterDocument = MarkdownDocument;

export interface DocumentStats {
  words: number;
  characters: number;
}

interface ParseOptions {
  id?: string;
  slug?: string;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_AUTHOR = "Madinah";
const DEFAULT_STATUS: DocumentStatus = "draft";

export function createSlug(input: string): string {
  const slug = input
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "untitled";
}

export function createDocumentId(seed: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `doc-${createSlug(seed)}-${random.toLowerCase()}`;
}

export function createEmptyDocument(now = new Date()): MarkdownDocument {
  const timestamp = now.toISOString();
  const title = "Untitled";

  return {
    id: createDocumentId(title),
    slug: createSlug(title),
    title,
    description: "",
    author: DEFAULT_AUTHOR,
    tags: [],
    status: DEFAULT_STATUS,
    pubDate: formatDateForFrontmatter(now),
    body: "# Untitled\n\n",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function parseMdxDocument(
  source: string,
  options: ParseOptions = {},
): MarkdownDocument {
  const parsed = parseFrontmatter(source);
  const now = new Date().toISOString();
  const title = toStringValue(parsed.data.title, "Untitled");
  const pubDate =
    toStringValue(parsed.data.pubDate, "") ||
    formatFrontmatterValue(parsed.data.pubDate ?? new Date());

  return {
    id: options.id ?? createDocumentId(title),
    slug: options.slug ?? createSlug(title),
    title,
    description: toStringValue(parsed.data.description, ""),
    author: toStringValue(parsed.data.author, DEFAULT_AUTHOR),
    tags: toStringArray(parsed.data.tags),
    status: toStatus(parsed.data.status),
    pubDate,
    body: parsed.content.trimStart().replace(/\s+$/u, ""),
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
  };
}

export const parseMarkdownDocument = parseMdxDocument;

export function serializeMdxDocument(document: MarkdownDocument): string {
  const frontmatter = [
    "---",
    `title: ${document.title}`,
    `author: ${document.author}`,
    `description: ${document.description}`,
    "tags:",
    ...document.tags.map((tag) => `  - ${tag}`),
    `pubDate: ${document.pubDate}`,
    `status: ${document.status}`,
    "---",
  ];

  return `${frontmatter.join("\n")}\n\n${document.body.trim()}\n`;
}

export const serializeMarkdownDocument = serializeMdxDocument;

export function extractDocumentTitle(source: string): string {
  const frontmatterTitle = parseFrontmatter(source).data.title;
  const parsedTitle = toStringValue(frontmatterTitle, "");
  if (parsedTitle) return parsedTitle;

  const heading = source.match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim() || "Untitled";
}

export function calculateDocumentStats(source: string): DocumentStats {
  const text = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\p{Letter}\p{Number}\s]+/gu, " ")
    .trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  return {
    words,
    characters: source.length,
  };
}

function toStringValue(value: unknown, fallback: string): string {
  if (value instanceof Date) {
    return formatDateForFrontmatter(value);
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item)))
    .filter(Boolean);
}

function toStatus(value: unknown): DocumentStatus {
  if (
    value === "draft" ||
    value === "published" ||
    value === "archived" ||
    value === "WIP"
  ) {
    return value;
  }

  return DEFAULT_STATUS;
}

function formatFrontmatterValue(value: unknown): string {
  if (value instanceof Date) {
    return formatDateForFrontmatter(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return formatDateForFrontmatter(new Date());
}

function parseFrontmatter(source: string): {
  data: Record<string, string | string[]>;
  content: string;
} {
  if (!source.startsWith("---")) {
    return { data: {}, content: source };
  }

  const closeIndex = source.indexOf("\n---", 3);
  if (closeIndex === -1) {
    return { data: {}, content: source };
  }

  const frontmatter = source.slice(3, closeIndex).trim();
  const content = source.slice(closeIndex + 4);
  const data: Record<string, string | string[]> = {};
  let activeListKey: string | null = null;

  for (const line of frontmatter.split(/\r?\n/)) {
    const keyMatch = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (keyMatch) {
      const [, key, rawValue] = keyMatch;
      const value = stripYamlQuotes(rawValue.trim());
      activeListKey = key;
      data[key] = value ? value : [];
      continue;
    }

    const listMatch = line.match(/^\s*-\s*(.+)$/);
    if (listMatch && activeListKey) {
      const current = data[activeListKey];
      const nextValue = stripYamlQuotes(listMatch[1].trim());
      data[activeListKey] = Array.isArray(current)
        ? [...current, nextValue]
        : [nextValue];
    }
  }

  return { data, content };
}

function stripYamlQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

export function formatDateForFrontmatter(date: Date): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

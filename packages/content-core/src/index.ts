import { parse, stringify } from "yaml";

const FRONTMATTER_RE = /^---\n([\s\S]*?\n)?---(?:\n|$)/;
const WORDS_PER_MINUTE = 200;

export const BLOG_POST_STATUS_OPTIONS = ["draft", "published", "archived", "WIP"] as const;

export type BlogPostStatus = (typeof BLOG_POST_STATUS_OPTIONS)[number];

export const PUBLISHED_BLOG_POST_STATUS = "published" satisfies BlogPostStatus;

export const SUPPORTED_BLOG_FILE_EXTENSIONS = [".md", ".mdx"] as const;

export const MADINAH_BLOG_CONTENT_DIR = "src/blogs";

export const MADINAH_SITE_URL = "https://madinah.felixwliu.cn";

export type SupportedBlogFileExtension = (typeof SUPPORTED_BLOG_FILE_EXTENSIONS)[number];

export type TitleSource = "frontmatter" | "h1" | "none";

export interface ParsedFile {
  frontmatter: string | null;
  body: string;
}

export interface ParsedDocument extends ParsedFile {
  title: string;
  titleSource: TitleSource;
}

export interface ReadingTime {
  text: string;
  minutes: number;
  time: number;
  words: number;
}

export interface BlogPostRouteOptions {
  contentDir?: string;
}

export interface BlogPostPublishInput {
  filePath: string;
  frontmatter: string | null;
  body: string;
}

export interface PrepareBlogPostForPublishInput extends BlogPostPublishInput {
  publishedAt?: Date;
}

export interface PreparedBlogPost {
  frontmatter: string;
  url: string;
}

export interface BlogPostPublishIssue {
  field: "path" | "frontmatter" | "title" | "pubDate" | "status" | "body";
  message: string;
}

export function isPublishedBlogPostStatus(status: BlogPostStatus): boolean {
  return status === PUBLISHED_BLOG_POST_STATUS;
}

export function isBlogPostStatus(value: string): value is BlogPostStatus {
  return BLOG_POST_STATUS_OPTIONS.includes(value as BlogPostStatus);
}

export function getBlogPostStatus(frontmatter: string | null): BlogPostStatus | null {
  const status = parseFrontmatterObject(frontmatter)?.status;
  return typeof status === "string" && isBlogPostStatus(status) ? status : null;
}

export function isSupportedBlogPostPath(filePath: string): boolean {
  return getSupportedBlogFileExtension(filePath) !== null;
}

export function getSupportedBlogFileExtension(filePath: string): SupportedBlogFileExtension | null {
  const normalized = normalizePath(filePath).toLowerCase();
  return SUPPORTED_BLOG_FILE_EXTENSIONS.find((extension) => normalized.endsWith(extension)) ?? null;
}

export function getBlogPostRouteId(filePath: string, options: BlogPostRouteOptions = {}): string {
  const normalized = normalizePath(filePath);
  const withoutContentDir = stripContentDir(normalized, options.contentDir ?? MADINAH_BLOG_CONTENT_DIR);
  const extension = getSupportedBlogFileExtension(normalized);
  if (extension === null) return trimSlashes(withoutContentDir);
  return trimSlashes(withoutContentDir.slice(0, -extension.length));
}

export function getBlogPostUrlPath(filePath: string, options: BlogPostRouteOptions = {}): string {
  return `/blog/${getBlogPostRouteId(filePath, options)}`;
}

export function getBlogPostUrl(
  filePath: string,
  siteUrl = MADINAH_SITE_URL,
  options: BlogPostRouteOptions = {},
): string {
  return new URL(getBlogPostUrlPath(filePath, options), ensureTrailingSlash(siteUrl)).toString();
}

export function isBlogPostContentPath(
  filePath: string,
  options: BlogPostRouteOptions = {},
): boolean {
  if (!isSupportedBlogPostPath(filePath)) return false;

  const normalized = trimSlashes(normalizePath(filePath));
  const contentDir = trimSlashes(normalizePath(options.contentDir ?? MADINAH_BLOG_CONTENT_DIR));
  return normalized.startsWith(`${contentDir}/`) || normalized.includes(`/${contentDir}/`);
}

export function prepareBlogPostForPublish({
  filePath,
  frontmatter,
  body,
  publishedAt = new Date(),
}: PrepareBlogPostForPublishInput): PreparedBlogPost {
  const metadata = parseMutableFrontmatter(frontmatter);
  const inferredTitle = inferTitle(body, frontmatter).title;

  if (typeof metadata.title !== "string" || metadata.title.trim() === "") {
    if (inferredTitle !== "") metadata.title = inferredTitle;
  }

  if (!hasUsableDate(metadata.pubDate)) {
    metadata.pubDate = publishedAt.toISOString();
  }
  metadata.status = PUBLISHED_BLOG_POST_STATUS;

  const preparedFrontmatter = stringify(metadata, { lineWidth: 0 }).trim();
  const issues = validateBlogPostForPublish({
    filePath,
    frontmatter: preparedFrontmatter,
    body,
  });
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(" "));
  }

  return {
    frontmatter: preparedFrontmatter,
    url: getBlogPostUrl(filePath),
  };
}

export function validateBlogPostForPublish({
  filePath,
  frontmatter,
  body,
}: BlogPostPublishInput): BlogPostPublishIssue[] {
  const issues: BlogPostPublishIssue[] = [];

  if (!isBlogPostContentPath(filePath)) {
    issues.push({
      field: "path",
      message: `Article must be inside ${MADINAH_BLOG_CONTENT_DIR}.`,
    });
  }

  let metadata: Record<string, unknown>;
  try {
    metadata = parseMutableFrontmatter(frontmatter);
  } catch (error) {
    issues.push({
      field: "frontmatter",
      message: error instanceof Error ? error.message : String(error),
    });
    return issues;
  }

  if (typeof metadata.title !== "string" || metadata.title.trim() === "") {
    issues.push({ field: "title", message: "Article title is required." });
  }
  if (!hasUsableDate(metadata.pubDate)) {
    issues.push({ field: "pubDate", message: "Publication date must be valid." });
  }
  if (metadata.status !== PUBLISHED_BLOG_POST_STATUS) {
    issues.push({ field: "status", message: "Article status must be published." });
  }
  if (body.trim() === "") {
    issues.push({ field: "body", message: "Article body is required." });
  }

  return issues;
}

export function parseFrontmatter(raw: string): ParsedFile {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return { frontmatter: null, body: raw };
  const fm = match[1] ? match[1].replace(/\n$/, "") : "";
  return { frontmatter: fm, body: raw.slice(match[0].length) };
}

export function serializeFile(frontmatter: string | null, body: string): string {
  if (frontmatter === null) return body;
  return `---\n${frontmatter}\n---\n${body}`;
}

export function parseDocument(raw: string): ParsedDocument {
  const parsed = parseFrontmatter(raw);
  const { title, titleSource } = inferTitle(parsed.body, parsed.frontmatter);

  return {
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    title,
    titleSource,
  };
}

export function inferTitle(
  body: string,
  frontmatter: string | null,
): { title: string; titleSource: TitleSource } {
  const frontmatterTitle = getFrontmatterTitle(frontmatter);
  if (frontmatterTitle !== null) {
    return { title: frontmatterTitle, titleSource: "frontmatter" };
  }

  const leadingHeading = getLeadingHeadingTitle(body);
  if (leadingHeading !== null) {
    return { title: leadingHeading, titleSource: "h1" };
  }

  return { title: "", titleSource: "none" };
}

export function serializeDocument(frontmatter: string | null, body: string): string {
  return serializeFile(frontmatter, body);
}

const displayDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function getFrontmatterDisplayDate(frontmatter: string | null): string | null {
  const parsed = parseFrontmatterObject(frontmatter);
  if (parsed === null) return null;

  for (const key of ["pubDate", "date", "updated"]) {
    const formatted = formatFrontmatterDateValue(parsed[key]);
    if (formatted !== null) return formatted;
  }

  return null;
}

export function calculateReadingTime(content: string | null | undefined): ReadingTime {
  const plainText = (content ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  const trimmedText = plainText.trim();
  const words = trimmedText ? trimmedText.split(/\s+/).length : 0;
  const minutes = words / WORDS_PER_MINUTE;
  const timeMs = Math.ceil(minutes * 60 * 1000);
  const displayMinutes = Math.ceil(minutes);

  return {
    text: `${displayMinutes} min read`,
    minutes: displayMinutes,
    time: timeMs,
    words,
  };
}

function parseFrontmatterObject(frontmatter: string | null): Record<string, unknown> | null {
  if (frontmatter === null || frontmatter.trim() === "") return {};

  let parsed: unknown;
  try {
    parsed = parse(frontmatter);
  } catch {
    return null;
  }

  if (
    parsed === null ||
    parsed === undefined ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    return null;
  }

  return parsed as Record<string, unknown>;
}

function parseMutableFrontmatter(frontmatter: string | null): Record<string, unknown> {
  if (frontmatter === null || frontmatter.trim() === "") return {};

  let parsed: unknown;
  try {
    parsed = parse(frontmatter);
  } catch (error) {
    throw new Error(
      `Frontmatter is invalid YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Frontmatter must be a YAML object.");
  }
  return { ...(parsed as Record<string, unknown>) };
}

function hasUsableDate(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.valueOf());
  if (typeof value !== "string" && typeof value !== "number") return false;
  return !Number.isNaN(Date.parse(String(value)));
}

function getFrontmatterTitle(frontmatter: string | null): string | null {
  const parsed = parseFrontmatterObject(frontmatter);
  if (parsed === null) return null;

  const title = parsed.title;
  if (typeof title !== "string") return null;

  const normalized = title.trim();
  return normalized === "" ? null : normalized;
}

function getLeadingHeadingTitle(body: string): string | null {
  const afterBlankLines = body.replace(/^(?:[ \t]*\n)*/, "");
  const newlineIndex = afterBlankLines.indexOf("\n");
  const firstLine = newlineIndex === -1 ? afterBlankLines : afterBlankLines.slice(0, newlineIndex);

  const match = firstLine.match(/^#\s+(.*)$/);
  if (!match) return null;

  const title = (match[1] ?? "").replace(/\s+#+\s*$/, "").trim();
  return title === "" ? null : title;
}

function formatFrontmatterDateValue(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? null : displayDateFormatter.format(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;

    const timestamp = Date.parse(trimmed);
    if (Number.isNaN(timestamp)) return trimmed;
    return displayDateFormatter.format(new Date(timestamp));
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value > 1_000_000_000_000 ? value : value * 1000);
    return Number.isNaN(date.valueOf()) ? null : displayDateFormatter.format(date);
  }

  return null;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function stripContentDir(filePath: string, contentDir: string): string {
  const normalizedContentDir = trimSlashes(normalizePath(contentDir));
  const normalizedFilePath = trimSlashes(filePath);

  if (normalizedContentDir === "") return normalizedFilePath;
  if (normalizedFilePath === normalizedContentDir) return "";

  const prefix = `${normalizedContentDir}/`;
  if (normalizedFilePath.startsWith(prefix)) return normalizedFilePath.slice(prefix.length);

  const nestedPrefix = `/${prefix}`;
  const nestedIndex = normalizedFilePath.indexOf(nestedPrefix);
  return nestedIndex >= 0
    ? normalizedFilePath.slice(nestedIndex + nestedPrefix.length)
    : normalizedFilePath;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

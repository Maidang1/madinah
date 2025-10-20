import type { ComponentType } from "react";
import type { ReadTimeResults } from "reading-time";

/**
 * The publication status supported by content tooling.
 */
export type PostStatus = "WIP" | "ready";

/**
 * A table-of-contents entry extracted from MDX headings.
 */
export interface TocItem {
  url: string;
  value: string;
  level?: number;
}

/**
 * Common props shared across blog layout variants.
 */
export interface BlogLayoutProps {
  title?: string;
  summary?: string;
  tocs: TocItem[];
  className?: string;
}

/**
 * Metadata describing a blog post that powers list views and detail pages.
 */
export interface PostInfo {
  title: string;
  tags: string[];
  summary: string;
  time: string;
  readingTime: ReadTimeResults;
  filename: string;
  url: string;
  toc: TocItem[];
  date: string;
  content: string;
  status?: PostStatus;
  author?: string;
}

/**
 * Options that tweak scroll tracking/spy helpers.
 */
export interface ScrollOptions {
  offset?: number;
  threshold?: number;
  highlightBuffer?: number;
  behavior?: ScrollBehavior;
}

/**
 * Supported site-wide theme preferences.
 */
export type Theme = "light" | "dark" | "system";

/**
 * Lightweight summary of a chapter used for book listings.
 */
export interface BookChapterInfo {
  id: string;
  title: string;
  order: number;
  summary: string;
}

/**
 * Serialized representation of a book and its chapters.
 */
export interface BookSummaryInfo {
  id: string;
  title: string;
  description: string;
  author: string;
  coverImage: string | null;
  tags: string[];
  defaultChapterId: string | null;
  hasOverview: boolean;
  chapterCount: number;
  chapters: BookChapterInfo[];
}

/**
 * Shape returned when dynamically importing an MDX module.
 */
export interface ChapterModuleResult<Component = unknown> {
  module: Component;
  frontmatter: Record<string, unknown> | null;
}

/**
 * Runtime-only chapter information produced by the virtual books module.
 */
export interface BookRuntimeChapter extends BookChapterInfo {
  load: () => Promise<ChapterModuleResult<ComponentType>>;
}

/**
 * Runtime-only book structure including lazily loaded chapters.
 */
export interface BookRuntimeInfo extends BookSummaryInfo {
  directoryName: string;
  loadOverview: (() => Promise<ChapterModuleResult<ComponentType>>) | null;
  chapterMap: Record<string, BookRuntimeChapter>;
  chapters: BookRuntimeChapter[];
}

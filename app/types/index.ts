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
 * Represents a single commit in a blog post's version history.
 * Contains commit metadata and optional GitHub URL for viewing the commit.
 */
export interface PostCommit {
  /** Short commit hash (7 characters) */
  hash: string;
  /** ISO 8601 timestamp of the commit */
  date: string;
  /** Commit message */
  message: string;
  /** Commit author name */
  author: string;
  /** Full GitHub commit URL (if repository is configured) */
  githubUrl?: string;
}

/**
 * Git-derived timestamps and version history for a blog post.
 * Extracted from Git commit history to track creation and modification times.
 */
export interface PostGitInfo {
  /** ISO 8601 timestamp of the first commit (creation time) */
  createdAt: string;
  /** ISO 8601 timestamp of the most recent commit (last modification time) */
  updatedAt: string;
  /** Complete version history, newest commits first */
  commits: PostCommit[];
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
  /** Git-derived metadata including creation/modification times and version history */
  gitInfo?: PostGitInfo;
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
 * Supported locales for internationalization.
 */
export type Locale = "en" | "zh";

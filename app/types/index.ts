import type { ReadTimeResults } from "reading-time"

export interface PostInfo {
  title: string,
  tags: string[]
  summary: string
  time: string,
  readingTime: ReadTimeResults,
  filename: string
  url: string
  toc: { url: string, value: string }[]
  date: string
  content: string
  status?: "WIP" | "ready"
}

export interface TocItem {
  url: string;
  value: string;
  level?: number;
}

export interface BlogLayoutProps {
  title?: string;
  summary?: string;
  tocs: TocItem[];
  className?: string;
}

export interface ScrollOptions {
  offset?: number;
  threshold?: number;
  highlightBuffer?: number;
  behavior?: ScrollBehavior;
}

export type Theme = "light" | "dark" | "system";

export interface BookChapterInfo {
  id: string;
  title: string;
  order: number;
  summary: string;
}

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
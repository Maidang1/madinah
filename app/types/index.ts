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

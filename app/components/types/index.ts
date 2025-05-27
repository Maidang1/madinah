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

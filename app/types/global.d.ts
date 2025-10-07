declare module 'virtual:blog-list' {
  const list: import(".").PostInfo[];
  export { list };
}

declare module 'virtual:book-data' {
  import type { ComponentType } from 'react';
  import type { BookSummaryInfo, BookChapterInfo } from "./index";

  export const booksRuntime: unknown;
  export const booksSerialized: BookSummaryInfo[];
  export function getBooks(): BookSummaryInfo[];
  export function getBook(bookId: string): unknown;
  export function getSerializedBook(bookId: string): BookSummaryInfo | null;
  export function getChapter(bookId: string, chapterId: string): unknown;
  export function getSerializedChapter(bookId: string, chapterId: string): BookChapterInfo | null;
  export function loadChapterModule(
    bookId: string,
    chapterId: string
  ): Promise<{ module: ComponentType; frontmatter: Record<string, unknown> | null } | null>;
  export function loadBookOverview(
    bookId: string
  ): Promise<{ module: ComponentType; frontmatter: Record<string, unknown> | null } | null>;
  const defaultExport: BookSummaryInfo[];
  export default defaultExport;
}

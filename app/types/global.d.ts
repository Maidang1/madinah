declare module "virtual:blog-list" {
  const list: import(".").PostInfo[];
  export { list };
}

declare module "virtual:book-data" {
  import type { ComponentType } from "react";
  import type {
    BookChapterInfo,
    BookRuntimeChapter,
    BookRuntimeInfo,
    BookSummaryInfo,
    ChapterModuleResult,
  } from "./index";

  export const booksRuntime: readonly BookRuntimeInfo[];
  export const booksSerialized: BookSummaryInfo[];
  export function getBooks(): BookSummaryInfo[];
  export function getBook(bookId: string): BookRuntimeInfo | null;
  export function getSerializedBook(bookId: string): BookSummaryInfo | null;
  export function getChapter(bookId: string, chapterId: string): BookRuntimeChapter | null;
  export function getSerializedChapter(bookId: string, chapterId: string): BookChapterInfo | null;
  export function loadChapterModule(
    bookId: string,
    chapterId: string
  ): Promise<ChapterModuleResult<ComponentType> | null>;
  export function loadBookOverview(
    bookId: string
  ): Promise<ChapterModuleResult<ComponentType> | null>;
  const defaultExport: readonly BookSummaryInfo[];
  export default defaultExport;
}

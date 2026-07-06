import { getDocumentStats, type DocumentStats } from "@/lib/document-stats";
import { getFrontmatterDisplayDate } from "@/lib/frontmatter";

export const EMPTY_DOCUMENT_STATS: DocumentStats = { words: 0, characters: 0, paragraphs: 0 };

export function withDerivedDate<T extends { frontmatter: string | null }>(file: T) {
  return { ...file, displayDate: getFrontmatterDisplayDate(file.frontmatter) };
}

export function withDerivedStats<T extends { content: string }>(file: T) {
  return { ...file, stats: getDocumentStats(file.content) };
}

export function withDerived<T extends { frontmatter: string | null; content: string }>(file: T) {
  return {
    ...file,
    displayDate: getFrontmatterDisplayDate(file.frontmatter),
    stats: getDocumentStats(file.content),
  };
}

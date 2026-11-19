import { useMemo } from "react";
import { useFileContent } from "@/hooks/use-tabs";
import {
  buildSlugIndex,
  parseDocumentHeadings,
  type DocumentHeading,
  type ParseDocumentHeadingsOptions,
} from "@/lib/document-headings";

export type { DocumentHeading, ParseDocumentHeadingsOptions };
export { buildSlugIndex, parseDocumentHeadings };

export interface DocumentHeadingsOptions {
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 3;
const FULL_DEPTH = 6;

export function useDocumentHeadings(
  filePath: string | null,
  options: DocumentHeadingsOptions = {},
): DocumentHeading[] {
  const content = useFileContent(filePath);
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  return useMemo(
    () => parseDocumentHeadings(content, { maxDepth, slugDepth: FULL_DEPTH }),
    [content, maxDepth],
  );
}

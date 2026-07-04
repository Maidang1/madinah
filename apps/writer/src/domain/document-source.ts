import type { MarkdownDocument } from "./document";

export type DocumentSource =
  | {
      kind: "draft";
      id: string;
    }
  | {
      kind: "file";
      path: string;
    };

export function createDraftDocumentSource(id: string): DocumentSource {
  return { kind: "draft", id };
}

export function createFileDocumentSource(path: string): DocumentSource {
  return { kind: "file", path };
}

export function createDocumentSource(
  document: MarkdownDocument,
  filePath?: string | null,
): DocumentSource {
  return filePath
    ? createFileDocumentSource(filePath)
    : createDraftDocumentSource(document.id);
}

export function getDocumentSourceFilePath(
  source: DocumentSource | null,
): string | null {
  return source?.kind === "file" ? source.path : null;
}

export function isDraftDocumentSource(
  source: DocumentSource | null,
): source is Extract<DocumentSource, { kind: "draft" }> {
  return source?.kind === "draft";
}

export function isFileDocumentSource(
  source: DocumentSource | null,
): source is Extract<DocumentSource, { kind: "file" }> {
  return source?.kind === "file";
}

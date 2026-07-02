import {
  serializeMdxDocument,
  type MarkdownDocument,
} from "../../domain/document";
import type {
  DocumentStore,
  FileStore,
  RecentStore,
  WindowAdapter,
} from "../../platform/ports";

export interface PublishStoredDocumentInput {
  id: string;
  targetPath: string;
  activeDocument: MarkdownDocument | null;
  activeFilePath: string | null;
  documentStore: DocumentStore;
  fileStore: FileStore;
  recentStore: RecentStore;
  now?: () => string;
}

export interface PublishStoredDocumentResult {
  document: MarkdownDocument;
  filePath: string;
}

export interface ConfirmPublishOverwriteInput {
  targetPath: string;
  fileStore: FileStore;
  windowAdapter: WindowAdapter;
}

export async function publishStoredDocumentToFile({
  activeDocument,
  activeFilePath,
  documentStore,
  fileStore,
  id,
  now = () => new Date().toISOString(),
  recentStore,
  targetPath,
}: PublishStoredDocumentInput): Promise<PublishStoredDocumentResult> {
  const current =
    activeDocument?.id === id && !activeFilePath
      ? activeDocument
      : await documentStore.get(id);
  const published: MarkdownDocument = {
    ...current,
    status: "published",
    updatedAt: now(),
  };

  await fileStore.writeMarkdownFile(targetPath, serializeMdxDocument(published));
  await recentStore.add(targetPath);
  await documentStore.delete(id);

  return {
    document: published,
    filePath: targetPath,
  };
}

export async function confirmPublishOverwrite({
  fileStore,
  targetPath,
  windowAdapter,
}: ConfirmPublishOverwriteInput): Promise<boolean> {
  try {
    await fileStore.readMarkdownFile(targetPath);
  } catch {
    return true;
  }

  return windowAdapter.confirm(
    `${fileNameFromPath(targetPath)} already exists. Overwrite it?`,
    { title: "Publish draft" },
  );
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

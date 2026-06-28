import type { MarkdownDocument } from "../../domain/document";

export interface DocumentVersion {
  id: string;
  targetId: string;
  title: string;
  description: string;
  author: string;
  tags: string[];
  status: MarkdownDocument["status"];
  pubDate: string;
  body: string;
  reason: string;
  createdAt: string;
}

interface CreateDocumentVersionInput {
  targetId: string;
  document: MarkdownDocument;
  reason: string;
  now?: Date;
}

export function createDocumentVersion({
  targetId,
  document,
  reason,
  now = new Date(),
}: CreateDocumentVersionInput): DocumentVersion {
  const createdAt = now.toISOString();
  return {
    id: `${targetId}:${createdAt}`,
    targetId,
    title: document.title,
    description: document.description,
    author: document.author,
    tags: [...document.tags],
    status: document.status,
    pubDate: document.pubDate,
    body: document.body,
    reason,
    createdAt,
  };
}

export function appendDocumentVersion(
  versions: DocumentVersion[],
  version: DocumentVersion,
  limit = 30,
): DocumentVersion[] {
  if (versions.some((item) => isSameDocumentVersion(item, version))) {
    return sortVersions(versions).slice(0, limit);
  }

  return sortVersions([version, ...versions]).slice(0, limit);
}

export function getVersionTargetId(
  document: MarkdownDocument,
  filePath: string | null,
): string {
  return filePath ?? document.id;
}

export function documentFromVersion(
  current: MarkdownDocument,
  version: DocumentVersion,
): MarkdownDocument {
  return {
    ...current,
    title: version.title,
    description: version.description,
    author: version.author,
    tags: [...version.tags],
    status: version.status,
    pubDate: version.pubDate,
    body: version.body,
  };
}

function sortVersions(versions: DocumentVersion[]): DocumentVersion[] {
  return [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function isSameDocumentVersion(
  left: DocumentVersion,
  right: DocumentVersion,
): boolean {
  return (
    left.targetId === right.targetId &&
    left.title === right.title &&
    left.description === right.description &&
    left.author === right.author &&
    left.status === right.status &&
    left.pubDate === right.pubDate &&
    left.body === right.body &&
    left.tags.length === right.tags.length &&
    left.tags.every((tag, index) => tag === right.tags[index])
  );
}

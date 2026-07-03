import {
  appendDocumentVersion,
  type DocumentVersion,
} from "./document-history";

const VERSION_HISTORY_KEY = "madinah-writer-version-history";

export interface DocumentHistoryStore {
  list(targetId: string): DocumentVersion[];
  save(version: DocumentVersion): DocumentVersion[];
  clear(targetId: string): void;
}

type VersionStorage = Pick<Storage, "getItem" | "setItem">;

export function createLocalDocumentHistoryStore(
  storage: VersionStorage = window.localStorage,
): DocumentHistoryStore {
  return {
    list(targetId) {
      return listVersions(readHistory(storage), targetId);
    },
    save(version) {
      const history = readHistory(storage);
      const versions = appendDocumentVersion(
        listVersions(history, version.targetId),
        version,
      );
      writeHistory(storage, {
        ...history,
        [version.targetId]: versions,
      });
      return versions;
    },
    clear(targetId) {
      const history = readHistory(storage);
      const { [targetId]: _removed, ...nextHistory } = history;
      writeHistory(storage, nextHistory);
    },
  };
}

function listVersions(
  history: Record<string, DocumentVersion[]>,
  targetId: string,
): DocumentVersion[] {
  return [...(history[targetId] ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

function readHistory(
  storage: VersionStorage,
): Record<string, DocumentVersion[]> {
  const raw = storage.getItem(VERSION_HISTORY_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, DocumentVersion[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeHistory(
  storage: VersionStorage,
  history: Record<string, DocumentVersion[]>,
) {
  storage.setItem(VERSION_HISTORY_KEY, JSON.stringify(history));
}

import type { DirEntry } from "@/types/fs";
import * as tauri from "@/lib/tauri";
import * as editorApi from "./editor-api";
import {
  isPathInsideWorkspace,
  isSameWorkspaceLease,
  type WorkspaceReadOnlyLease,
  type WorkspaceReconciliationFailure,
  type WorkspaceReconciliationOutcome,
} from "@/domain/workspace-turn-lifecycle";
import { useWorkspaceStore, type WorkspaceDirectoryReconciliation } from "@/stores/workspace-store";

export type {
  WorkspaceReadOnlyLease,
  WorkspaceReconciliationOutcome,
} from "@/domain/workspace-turn-lifecycle";

type WorkspaceDocumentRead =
  | {
      status: "reloaded";
      snapshot: editorApi.WorkspaceDocumentSnapshot;
      content: string;
    }
  | { status: "deleted"; snapshot: editorApi.WorkspaceDocumentSnapshot }
  | {
      status: "failed";
      snapshot: editorApi.WorkspaceDocumentSnapshot;
      message: string;
    };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isLeaseCurrent(lease: WorkspaceReadOnlyLease) {
  return isSameWorkspaceLease(useWorkspaceStore.getState().readOnlyLease, lease);
}

async function readDirectory(path: string): Promise<WorkspaceDirectoryReconciliation> {
  try {
    return { status: "reloaded", path, entries: await tauri.readDirectory(path) };
  } catch (error) {
    try {
      if (!(await tauri.fileExists(path))) return { status: "deleted", path };
    } catch {
      // Preserve the original read failure when existence cannot be confirmed.
    }
    return { status: "failed", path, message: errorMessage(error) };
  }
}

async function readDocument(
  snapshot: editorApi.WorkspaceDocumentSnapshot,
): Promise<WorkspaceDocumentRead> {
  try {
    const content = await tauri.readFile(snapshot.path);
    return { status: "reloaded", snapshot, content: content.content };
  } catch (error) {
    try {
      if (!(await tauri.fileExists(snapshot.path))) return { status: "deleted", snapshot };
    } catch {
      // Preserve the original read failure when existence cannot be confirmed.
    }
    return { status: "failed", snapshot, message: errorMessage(error) };
  }
}

export function getWorkspaceRoot() {
  return useWorkspaceStore.getState().root;
}

export async function reconcileWorkspace(
  lease: WorkspaceReadOnlyLease,
): Promise<WorkspaceReconciliationOutcome> {
  if (!isLeaseCurrent(lease)) return { status: "stale-workspace", failures: [] };

  let stats: Awaited<ReturnType<typeof tauri.indexWorkspace>>;
  try {
    stats = await tauri.indexWorkspace();
  } catch (error) {
    if (!isLeaseCurrent(lease)) return { status: "stale-workspace", failures: [] };
    return {
      status: "failed",
      failures: [{ phase: "index", message: errorMessage(error) }],
    };
  }
  if (!isLeaseCurrent(lease)) return { status: "stale-workspace", failures: [] };

  let rootEntries: DirEntry[];
  try {
    rootEntries = await tauri.readDirectory(lease.root);
  } catch (error) {
    if (!isLeaseCurrent(lease)) return { status: "stale-workspace", failures: [] };
    return {
      status: "failed",
      fileCount: stats.file_count,
      failures: [{ phase: "directory", path: lease.root, message: errorMessage(error) }],
    };
  }
  if (!isLeaseCurrent(lease)) return { status: "stale-workspace", failures: [] };

  const workspace = useWorkspaceStore.getState();
  const nestedDirectoryPaths = [
    ...new Set([...workspace.directoryCache.keys(), ...workspace.expandedDirs]),
  ].filter((path) => path !== lease.root && isPathInsideWorkspace(path, lease.root));
  const documentSnapshots = editorApi.snapshotWorkspaceDocuments(lease.root);
  const [directoryResults, documentResults] = await Promise.all([
    Promise.all(nestedDirectoryPaths.map(readDirectory)),
    Promise.all(documentSnapshots.map(readDocument)),
  ]);
  if (!isLeaseCurrent(lease)) return { status: "stale-workspace", failures: [] };

  const failures: WorkspaceReconciliationFailure[] = directoryResults.flatMap((result) =>
    result.status === "failed"
      ? [{ phase: "directory" as const, path: result.path, message: result.message }]
      : [],
  );
  failures.push(
    ...documentResults.flatMap((result) =>
      result.status === "failed"
        ? [
            {
              phase: "document" as const,
              path: result.snapshot.path,
              message: result.message,
            },
          ]
        : [],
    ),
  );

  const projectionApplied = useWorkspaceStore
    .getState()
    .applyReconciliationProjection(lease, stats.file_count, rootEntries, directoryResults);
  if (!projectionApplied || !isLeaseCurrent(lease)) {
    return { status: "stale-workspace", failures: [] };
  }

  for (const result of documentResults) {
    if (result.status === "reloaded") {
      editorApi.applyWorkspaceDocumentReconciliation({
        status: "reloaded",
        snapshot: result.snapshot,
        content: result.content,
      });
    } else if (result.status === "deleted") {
      editorApi.applyWorkspaceDocumentReconciliation({
        status: "deleted",
        snapshot: result.snapshot,
      });
    }
  }

  return {
    status: failures.length > 0 ? "completed-with-errors" : "completed",
    fileCount: stats.file_count,
    failures,
  };
}

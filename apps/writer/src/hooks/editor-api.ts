import { useEditorStore } from "@/stores/editor-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { flushSave } from "@/lib/save";
import type { WorkspaceReadOnlyLease } from "@/domain/workspace-turn-lifecycle";
import type { WriterMutationPreparation } from "@/platform/tauri/fs";
import { isPathInsideWorkspace, isSameWorkspaceLease } from "@/domain/workspace-turn-lifecycle";
export type { OpenFile, Tab, SessionTab } from "@/domain/editor-session";
export type { WorkspaceReadOnlyLease } from "@/domain/workspace-turn-lifecycle";

export interface WorkspaceDocumentFlushFailure {
  path: string;
  message: string;
}

export interface WorkspaceDocumentSnapshot {
  path: string;
  instanceId: number;
}

export type WorkspaceDocumentReconciliation =
  | { status: "reloaded"; snapshot: WorkspaceDocumentSnapshot; content: string }
  | { status: "deleted"; snapshot: WorkspaceDocumentSnapshot };

export class WorkspaceDocumentFlushError extends Error {
  readonly failures: WorkspaceDocumentFlushFailure[];

  constructor(failures: WorkspaceDocumentFlushFailure[]) {
    super(`Failed to flush Workspace Documents: ${failures.map(({ path }) => path).join(", ")}`);
    this.name = "WorkspaceDocumentFlushError";
    this.failures = failures;
  }
}

export function getOpenFile(path: string) {
  return useEditorStore.getState().openFiles.get(path) ?? null;
}

export function getOpenFiles() {
  return useEditorStore.getState().openFiles;
}

export function getActiveFilePath() {
  return useEditorStore.getState().activeFilePath;
}

export function snapshotWorkspaceDocuments(workspaceRoot: string): WorkspaceDocumentSnapshot[] {
  return [...useEditorStore.getState().openFiles.values()]
    .filter((file) => isPathInsideWorkspace(file.path, workspaceRoot))
    .map(({ path, instanceId }) => ({ path, instanceId }));
}

export function applyWorkspaceDocumentReconciliation(
  result: WorkspaceDocumentReconciliation,
): boolean {
  const current = useEditorStore.getState().openFiles.get(result.snapshot.path);
  if (!current || current.instanceId !== result.snapshot.instanceId) return false;

  if (result.status === "reloaded") {
    useEditorStore.getState().reloadFromDisk(result.snapshot.path, result.content);
  } else {
    useEditorStore.getState().removePathReferences(result.snapshot.path);
  }
  return true;
}

export async function flushWorkspaceDocuments(
  workspaceRoot: string,
  preparation: WriterMutationPreparation | null = null,
) {
  const dirtyPaths = [...useEditorStore.getState().openFiles.values()]
    .filter((file) => file.isDirty && isPathInsideWorkspace(file.path, workspaceRoot))
    .map((file) => file.path);
  const results = await Promise.allSettled(dirtyPaths.map((path) => flushSave(path, preparation)));
  const failures = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          {
            path: dirtyPaths[index]!,
            message: result.reason instanceof Error ? result.reason.message : String(result.reason),
          },
        ]
      : [],
  );
  if (failures.length > 0) {
    throw new WorkspaceDocumentFlushError(failures);
  }
}

export function acquireWorkspaceReadOnly(root: string) {
  return useWorkspaceStore.getState().acquireReadOnly(root);
}

export function releaseWorkspaceReadOnly(lease: WorkspaceReadOnlyLease) {
  return useWorkspaceStore.getState().releaseReadOnly(lease);
}

export function isWorkspaceReadOnly(lease?: WorkspaceReadOnlyLease) {
  const activeLease = useWorkspaceStore.getState().readOnlyLease;
  return lease ? isSameWorkspaceLease(activeLease, lease) : activeLease !== null;
}

export function openFile(path: string) {
  return useEditorStore.getState().openFile(path);
}

export function closeFile(path: string) {
  useEditorStore.getState().closeFile(path);
}

export function closeActiveTab() {
  useEditorStore.getState().closeActiveTab();
}

export function markSaved(path: string, diskContent: string) {
  useEditorStore.getState().markSaved(path, diskContent);
}

export function updateContent(path: string, content: string) {
  if (isWorkspaceReadOnly()) return;
  useEditorStore.getState().updateContent(path, content);
}

export function updateCursorPos(path: string, pos: number) {
  useEditorStore.getState().updateCursorPos(path, pos);
}

export function updateScrollPos(path: string, pos: number) {
  useEditorStore.getState().updateScrollPos(path, pos);
}

export function updateFrontmatter(path: string, frontmatter: string | null) {
  if (isWorkspaceReadOnly()) return;
  useEditorStore.getState().updateFrontmatter(path, frontmatter);
}

export function reloadFromDisk(path: string, rawContent: string) {
  useEditorStore.getState().reloadFromDisk(path, rawContent);
}

export function navigateToFile(path: string) {
  return useEditorStore.getState().navigateToFile(path);
}

export function renameOpenFile(oldPath: string, newPath: string) {
  useEditorStore.getState().renameOpenFile(oldPath, newPath);
}

export function openFileInNewTab(path: string) {
  return useEditorStore.getState().openFileInNewTab(path);
}

export function removePathReferences(path: string) {
  useEditorStore.getState().removePathReferences(path);
}

export function removePathsWithPrefix(prefix: string) {
  useEditorStore.getState().removePathsWithPrefix(prefix);
}

export function rewritePathPrefix(oldPrefix: string, newPrefix: string) {
  useEditorStore.getState().rewritePathPrefix(oldPrefix, newPrefix);
}

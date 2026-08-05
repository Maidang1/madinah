export interface WorkspaceReadOnlyLease {
  readonly root: string;
  readonly generation: number;
  readonly id: number;
}

export type WorkspaceReconciliationPhase = "index" | "directory" | "document" | "lifecycle";

export interface WorkspaceReconciliationFailure {
  phase: WorkspaceReconciliationPhase;
  path?: string;
  message: string;
}

export interface WorkspaceReconciliationOutcome {
  status: "completed" | "completed-with-errors" | "stale-workspace" | "failed";
  fileCount?: number;
  failures: WorkspaceReconciliationFailure[];
}

export function isSameWorkspaceLease(
  left: WorkspaceReadOnlyLease | null,
  right: WorkspaceReadOnlyLease,
) {
  return left?.root === right.root && left.generation === right.generation && left.id === right.id;
}

export function isPathInsideWorkspace(path: string, root: string) {
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return path.startsWith(prefix);
}

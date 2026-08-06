import * as editorApi from "./editor-api";
import * as workspaceApi from "./workspace-api";
import type {
  WorkspaceReadOnlyLease,
  WorkspaceReconciliationOutcome,
} from "@/domain/workspace-turn-lifecycle";
import type { WriterMutationPreparation } from "@/platform/tauri/fs";

export async function prepareWorkspaceTurn(
  root: string,
  preparation: WriterMutationPreparation | null = null,
): Promise<WorkspaceReadOnlyLease> {
  const lease = editorApi.acquireWorkspaceReadOnly(root);
  try {
    if (preparation) await editorApi.flushWorkspaceDocuments(root, preparation);
    else await editorApi.flushWorkspaceDocuments(root);
    if (!editorApi.isWorkspaceReadOnly(lease)) {
      throw new Error(`Workspace changed during preparation: ${root}`);
    }
    return lease;
  } catch (error) {
    editorApi.releaseWorkspaceReadOnly(lease);
    throw error;
  }
}

export async function reconcileWorkspaceTurn(
  lease: WorkspaceReadOnlyLease,
  options: { retainReadOnly?: boolean } = {},
): Promise<WorkspaceReconciliationOutcome> {
  let outcome: WorkspaceReconciliationOutcome;
  try {
    outcome = await workspaceApi.reconcileWorkspace(lease);
  } catch (error) {
    outcome = {
      status: "failed",
      failures: [
        {
          phase: "lifecycle",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  } finally {
    if (!options.retainReadOnly) editorApi.releaseWorkspaceReadOnly(lease);
  }
  return outcome;
}

export function releaseWorkspaceTurn(lease: WorkspaceReadOnlyLease) {
  editorApi.releaseWorkspaceReadOnly(lease);
}

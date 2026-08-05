import * as editorApi from "./editor-api";
import * as workspaceApi from "./workspace-api";
import type {
  WorkspaceReadOnlyLease,
  WorkspaceReconciliationOutcome,
} from "@/domain/workspace-turn-lifecycle";

export async function prepareWorkspaceTurn(root: string): Promise<WorkspaceReadOnlyLease> {
  const lease = editorApi.acquireWorkspaceReadOnly(root);
  try {
    await editorApi.flushWorkspaceDocuments(root);
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
    editorApi.releaseWorkspaceReadOnly(lease);
  }
  return outcome;
}

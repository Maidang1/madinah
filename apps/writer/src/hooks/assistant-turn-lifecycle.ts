import {
  acknowledgeAgentTurnPrepared,
  acknowledgeAgentTurnReconciled,
  listenAgentTurnEvents,
  registerAgentTurnBridge,
  unregisterAgentTurnBridge,
  type AgentTurnEvent,
} from "@/platform/tauri/assistant";
import { useAssistantStore } from "@/stores/assistant-store";
import type { WorkspaceReadOnlyLease } from "@/domain/workspace-turn-lifecycle";
import {
  prepareWorkspaceTurn,
  reconcileWorkspaceTurn,
  releaseWorkspaceTurn,
} from "./workspace-turn-lifecycle";

const bridgeIdsByRoot = new Map<string, string>();

export async function connectAssistantTurnLifecycle(
  workspaceRoot: string,
  workspaceGeneration: number,
  signal?: AbortSignal,
  currentGeneration: () => number = () => workspaceGeneration,
): Promise<() => void> {
  let active = true;
  const cancelled = () => Boolean(signal?.aborted);
  const leases = new Map<string, WorkspaceReadOnlyLease>();
  const unlisten = await listenAgentTurnEvents((event) => {
    if (
      !active ||
      cancelled() ||
      currentGeneration() !== workspaceGeneration ||
      event.workspaceRoot !== workspaceRoot
    )
      return;
    void handleTurnEvent(event, workspaceRoot, workspaceGeneration, leases);
  });
  if (!active || cancelled()) {
    unlisten();
    return () => {};
  }
  try {
    const bridge = await registerAgentTurnBridge(
      workspaceRoot,
      workspaceGeneration,
      bridgeIdsByRoot.get(workspaceRoot),
    );
    bridgeIdsByRoot.set(workspaceRoot, bridge.bridgeId);
    if (!active || cancelled()) {
      await unregisterAgentTurnBridge(workspaceRoot, bridge.bridgeId);
      if (bridgeIdsByRoot.get(workspaceRoot) === bridge.bridgeId) {
        bridgeIdsByRoot.delete(workspaceRoot);
      }
      return () => {};
    }
    useAssistantStore.getState().setTurnBridgeReady(workspaceRoot, workspaceGeneration, true);
    return () => {
      active = false;
      unlisten();
      for (const lease of leases.values()) releaseWorkspaceTurn(lease);
      leases.clear();
      useAssistantStore.getState().setTurnBridgeReady(workspaceRoot, workspaceGeneration, false);
      void unregisterAgentTurnBridge(workspaceRoot, bridge.bridgeId).catch((error: unknown) => {
        console.error("Could not unregister the Agent Turn lifecycle bridge", error);
      });
      if (bridgeIdsByRoot.get(workspaceRoot) === bridge.bridgeId) {
        bridgeIdsByRoot.delete(workspaceRoot);
      }
    };
  } catch (error) {
    unlisten();
    useAssistantStore
      .getState()
      .reportTurnBridgeFailure(workspaceRoot, workspaceGeneration, errorMessage(error));
    throw error;
  }
}

async function handleTurnEvent(
  event: AgentTurnEvent,
  workspaceRoot: string,
  workspaceGeneration: number,
  leases: Map<string, WorkspaceReadOnlyLease>,
) {
  if (event.workspaceRoot !== workspaceRoot) return;
  if (event.type === "prepare") {
    let acquiredLease: Awaited<ReturnType<typeof prepareWorkspaceTurn>> | null = null;
    try {
      const lease = await prepareWorkspaceTurn(workspaceRoot, {
        turnId: event.turnId,
        workspaceRoot: event.workspaceRoot,
        workspaceEpoch: event.workspaceEpoch,
        participantToken: event.participantToken,
        bridgeId: event.bridgeId,
        requestId: event.requestId,
      });
      acquiredLease = lease;
      if (lease.generation !== workspaceGeneration) {
        throw new Error("Workspace changed while preparing the Agent Turn.");
      }
      await acknowledgeAgentTurnPrepared({
        ...event,
        lease: { generation: lease.generation, id: lease.id },
        error: null,
      });
      leases.set(event.turnId, lease);
    } catch (error) {
      if (acquiredLease) await reconcileWorkspaceTurn(acquiredLease);
      leases.delete(event.turnId);
      try {
        await acknowledgeAgentTurnPrepared({
          ...event,
          lease: null,
          error: errorMessage(error),
        });
      } catch {
        // The bridge may have been withdrawn while cleanup released its lease.
      }
    }
    return;
  }
  if (event.type === "reconcile") {
    const lease = leases.get(event.turnId);
    if (
      !lease ||
      lease.root !== event.workspaceRoot ||
      lease.generation !== event.lease.generation ||
      lease.id !== event.lease.id
    ) {
      return;
    }
    const outcome = await reconcileWorkspaceTurn(lease, { retainReadOnly: true });
    useAssistantStore
      .getState()
      .recordReconciliation(workspaceRoot, workspaceGeneration, event.conversationId, outcome);
    await acknowledgeAgentTurnReconciled({
      ...event,
      result: outcome.status === "completed" ? "completed" : "failed",
    });
    return;
  }
  if (event.type === "terminal") {
    const lease = leases.get(event.turnId);
    if (lease) {
      releaseWorkspaceTurn(lease);
      leases.delete(event.turnId);
    }
  }
  useAssistantStore.getState().receiveTurnEvent(event);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

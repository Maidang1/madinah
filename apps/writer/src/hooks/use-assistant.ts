import { useEffect } from "react";
import { useAssistantStore } from "@/stores/assistant-store";
import { useWorkspaceGeneration, useWorkspaceRoot } from "./use-workspace";
import { openExternalUrl } from "@/platform/tauri/window";
import { connectAssistantTurnLifecycle } from "./assistant-turn-lifecycle";
import { useWorkspaceStore } from "@/stores/workspace-store";

export type {
  AssistantConsent,
  AssistantDiscoveryPhase,
  TemporaryAssistantConversation,
} from "@/stores/assistant-store";

export function isAssistantConversationActive(
  conversation: import("@/stores/assistant-store").TemporaryAssistantConversation | null,
) {
  return (
    conversation !== null && conversation.status !== "completed" && conversation.status !== "failed"
  );
}

export function useAssistantDiscoveryLifecycle() {
  const workspaceRoot = useWorkspaceRoot();
  const workspaceGeneration = useWorkspaceGeneration();
  const activateWorkspace = useAssistantStore((state) => state.activateWorkspace);
  const deactivateWorkspace = useAssistantStore((state) => state.deactivateWorkspace);
  const refresh = useAssistantStore((state) => state.refresh);
  const loadConsent = useAssistantStore((state) => state.loadConsent);

  useEffect(() => {
    if (!workspaceRoot) {
      deactivateWorkspace();
      return;
    }
    activateWorkspace(workspaceRoot, workspaceGeneration);
    void refresh();
    void loadConsent();
    let disposed = false;
    const abortController = new AbortController();
    let disconnect: (() => void) | undefined;
    void connectAssistantTurnLifecycle(
      workspaceRoot,
      workspaceGeneration,
      abortController.signal,
      () => useWorkspaceStore.getState().generation,
    )
      .then((connected) => {
        if (disposed) connected();
        else disconnect = connected;
      })
      .catch((error: unknown) => {
        if (!disposed) console.error("Could not connect the Agent Turn lifecycle", error);
      });
    return () => {
      disposed = true;
      abortController.abort();
      disconnect?.();
      deactivateWorkspace();
    };
  }, [
    activateWorkspace,
    deactivateWorkspace,
    loadConsent,
    refresh,
    workspaceGeneration,
    workspaceRoot,
  ]);
}

export function useAssistantPhase() {
  return useAssistantStore((state) => state.phase);
}

export function useAssistantAgents() {
  return useAssistantStore((state) => state.agents);
}

export function useAssistantError() {
  return useAssistantStore((state) => state.error);
}

export function useAssistantRegistrationError() {
  return useAssistantStore((state) => state.registrationError);
}

export function useRefreshAssistant() {
  return useAssistantStore((state) => state.refresh);
}

export function useAddCustomAgent() {
  return useAssistantStore((state) => state.addCustom);
}

export function useRemoveCustomAgent() {
  return useAssistantStore((state) => state.removeCustom);
}

export function useOpenAgentSetup() {
  return openExternalUrl;
}

export function useAssistantConsent() {
  return useAssistantStore((state) => state.consent);
}

export function useGrantAssistantConsent() {
  return useAssistantStore((state) => state.grantConsent);
}

export function useSelectedAssistantAgent() {
  return useAssistantStore((state) => state.selectedAgentId);
}

export function useSelectAssistantAgent() {
  return useAssistantStore((state) => state.selectAgent);
}

export function useAssistantConversation() {
  return useAssistantStore((state) => state.conversation);
}

export function useAssistantTurnBridgeReady() {
  return useAssistantStore((state) => state.turnBridgeReady);
}

export function useSendAssistantTurn() {
  return useAssistantStore((state) => state.send);
}

export function useRespondAssistantPermission() {
  return useAssistantStore((state) => state.respondPermission);
}

import { useEffect } from "react";
import { useAssistantStore } from "@/stores/assistant-store";
import { useWorkspaceGeneration, useWorkspaceRoot } from "./use-workspace";
import { openExternalUrl } from "@/platform/tauri/window";

export type { AssistantDiscoveryPhase } from "@/stores/assistant-store";

export function useAssistantDiscoveryLifecycle() {
  const workspaceRoot = useWorkspaceRoot();
  const workspaceGeneration = useWorkspaceGeneration();
  const activateWorkspace = useAssistantStore((state) => state.activateWorkspace);
  const deactivateWorkspace = useAssistantStore((state) => state.deactivateWorkspace);
  const refresh = useAssistantStore((state) => state.refresh);

  useEffect(() => {
    if (!workspaceRoot) {
      deactivateWorkspace();
      return;
    }
    activateWorkspace(workspaceRoot, workspaceGeneration);
    void refresh();
    return deactivateWorkspace;
  }, [activateWorkspace, deactivateWorkspace, refresh, workspaceGeneration, workspaceRoot]);
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

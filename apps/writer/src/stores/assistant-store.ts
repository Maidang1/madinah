import { create } from "zustand";
import {
  addAgentRegistration,
  cancelAgentDiscovery,
  discoverAgentRuntimes,
  removeAgentRegistration,
  type AgentDiscovery,
} from "@/platform/tauri/assistant";

export type AssistantDiscoveryPhase = "idle" | "loading" | "ready" | "error";

interface AssistantState {
  phase: AssistantDiscoveryPhase;
  workspaceRoot: string | null;
  workspaceGeneration: number | null;
  requestToken: number;
  registrationRevision: number;
  registrationError: string | null;
  error: string | null;
  agents: AgentDiscovery[];

  activateWorkspace: (workspaceRoot: string, workspaceGeneration: number) => void;
  deactivateWorkspace: () => void;
  refresh: () => Promise<void>;
  addCustom: (command: string, args: string[]) => Promise<void>;
  removeCustom: (id: string) => Promise<void>;
}

const INITIAL_DISCOVERY_STATE = {
  phase: "idle" as const,
  workspaceRoot: null,
  workspaceGeneration: null,
  requestToken: 0,
  registrationRevision: 0,
  registrationError: null,
  error: null,
  agents: [],
};

export const useAssistantStore = create<AssistantState>((set, get) => ({
  ...INITIAL_DISCOVERY_STATE,

  activateWorkspace: (workspaceRoot, workspaceGeneration) => {
    const current = get();
    if (
      current.workspaceRoot === workspaceRoot &&
      current.workspaceGeneration === workspaceGeneration
    ) {
      return;
    }
    set({
      ...INITIAL_DISCOVERY_STATE,
      workspaceRoot,
      workspaceGeneration,
      requestToken: current.requestToken + 1,
    });
  },

  deactivateWorkspace: () => {
    set((state) => ({
      ...INITIAL_DISCOVERY_STATE,
      requestToken: state.requestToken + 1,
    }));
    void cancelAgentDiscovery().catch((error: unknown) => {
      console.error("Could not cancel Agent discovery", error);
    });
  },

  refresh: async () => {
    const before = get();
    if (!before.workspaceRoot || before.workspaceGeneration === null) return;
    const workspaceRoot = before.workspaceRoot;
    const workspaceGeneration = before.workspaceGeneration;
    const requestToken = before.requestToken + 1;
    set({ phase: "loading", error: null, requestToken });

    try {
      const response = await discoverAgentRuntimes(workspaceRoot);
      const current = get();
      if (
        current.workspaceRoot !== workspaceRoot ||
        current.workspaceGeneration !== workspaceGeneration ||
        current.requestToken !== requestToken ||
        response.workspaceRoot !== workspaceRoot
      ) {
        return;
      }
      set({
        phase: "ready",
        agents: response.agents,
        registrationRevision: response.registrationRevision,
        registrationError: response.registrationError,
        error: null,
      });
    } catch (error) {
      const current = get();
      if (
        current.workspaceRoot !== workspaceRoot ||
        current.workspaceGeneration !== workspaceGeneration ||
        current.requestToken !== requestToken
      ) {
        return;
      }
      set({ phase: "error", error: errorMessage(error) });
    }
  },

  addCustom: async (command, args) => {
    const { workspaceRoot, workspaceGeneration } = get();
    if (!workspaceRoot || workspaceGeneration === null) {
      throw new Error("Open a Workspace before registering an Agent.");
    }
    await addAgentRegistration(workspaceRoot, command, args);
    const current = get();
    if (
      current.workspaceRoot === workspaceRoot &&
      current.workspaceGeneration === workspaceGeneration
    ) {
      await current.refresh();
    }
  },

  removeCustom: async (id) => {
    const { workspaceRoot, workspaceGeneration } = get();
    if (!workspaceRoot || workspaceGeneration === null) return;
    await removeAgentRegistration(workspaceRoot, id);
    const current = get();
    if (
      current.workspaceRoot === workspaceRoot &&
      current.workspaceGeneration === workspaceGeneration
    ) {
      await current.refresh();
    }
  },
}));

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

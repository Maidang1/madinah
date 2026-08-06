import { create } from "zustand";
import {
  addAgentRegistration,
  cancelAgentDiscovery,
  discoverAgentRuntimes,
  removeAgentRegistration,
  getAiAccessConsent,
  grantAiAccessConsent,
  startAgentTurn,
  respondAgentTurnPermission,
  type AgentTurnEvent,
  type AgentDiscovery,
} from "@/platform/tauri/assistant";
import type { WorkspaceReconciliationOutcome } from "@/domain/workspace-turn-lifecycle";

export type AssistantDiscoveryPhase = "idle" | "loading" | "ready" | "error";
export type AssistantConsent = "unknown" | "loading" | "required" | "granted";
export type AssistantTurnStatus =
  | "starting"
  | "preparing"
  | "running"
  | "awaiting-permission"
  | "reconciling"
  | "reconciliation-blocked"
  | "completed"
  | "failed";

export interface TemporaryAssistantConversation {
  id: string;
  turnId: string | null;
  prompt: string;
  output: string;
  changeSummaries: string[];
  status: AssistantTurnStatus;
  message: string | null;
  reconciliation: WorkspaceReconciliationOutcome | null;
  permission: {
    requestId: string;
    title: string;
    options: Array<{ id: string; name: string; kind: string }>;
    responding: boolean;
  } | null;
}

interface AssistantState {
  phase: AssistantDiscoveryPhase;
  workspaceRoot: string | null;
  workspaceGeneration: number | null;
  requestToken: number;
  registrationRevision: number;
  registrationError: string | null;
  error: string | null;
  agents: AgentDiscovery[];
  consent: AssistantConsent;
  selectedAgentId: string | null;
  turnBridgeReady: boolean;
  conversation: TemporaryAssistantConversation | null;

  activateWorkspace: (workspaceRoot: string, workspaceGeneration: number) => void;
  deactivateWorkspace: () => void;
  refresh: () => Promise<void>;
  addCustom: (command: string, args: string[]) => Promise<void>;
  removeCustom: (id: string) => Promise<void>;
  loadConsent: () => Promise<void>;
  grantConsent: () => Promise<void>;
  selectAgent: (id: string) => void;
  setTurnBridgeReady: (workspaceRoot: string, workspaceGeneration: number, ready: boolean) => void;
  reportTurnBridgeFailure: (
    workspaceRoot: string,
    workspaceGeneration: number,
    message: string,
  ) => void;
  send: (prompt: string) => Promise<void>;
  receiveTurnEvent: (event: AgentTurnEvent) => void;
  recordReconciliation: (
    workspaceRoot: string,
    workspaceGeneration: number,
    conversationId: string,
    outcome: WorkspaceReconciliationOutcome,
  ) => void;
  respondPermission: (optionId: string | null) => Promise<void>;
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
  consent: "unknown" as const,
  selectedAgentId: null,
  turnBridgeReady: false,
  conversation: null,
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
      const compatibleAgentIds = new Set(
        response.agents.filter((agent) => agent.status === "compatible").map((agent) => agent.id),
      );
      set({
        phase: "ready",
        agents: response.agents,
        selectedAgentId:
          current.selectedAgentId && compatibleAgentIds.has(current.selectedAgentId)
            ? current.selectedAgentId
            : (response.agents.find((agent) => agent.status === "compatible")?.id ?? null),
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
    const { workspaceRoot, workspaceGeneration, conversation } = get();
    if (conversation && !isTerminal(conversation.status)) {
      throw new Error("Agent registrations cannot change during an active Agent Turn.");
    }
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
    const { workspaceRoot, workspaceGeneration, conversation } = get();
    if (conversation && !isTerminal(conversation.status)) {
      throw new Error("Agent registrations cannot change during an active Agent Turn.");
    }
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

  loadConsent: async () => {
    const before = get();
    if (!before.workspaceRoot || before.workspaceGeneration === null) return;
    const { workspaceRoot, workspaceGeneration } = before;
    set({ consent: "loading" });
    try {
      const status = await getAiAccessConsent(workspaceRoot);
      const current = get();
      if (
        current.workspaceRoot !== workspaceRoot ||
        current.workspaceGeneration !== workspaceGeneration ||
        status.workspaceRoot !== workspaceRoot
      ) {
        return;
      }
      set({ consent: status.granted ? "granted" : "required" });
    } catch (error) {
      const current = get();
      if (
        current.workspaceRoot === workspaceRoot &&
        current.workspaceGeneration === workspaceGeneration
      ) {
        set({ consent: "required", error: errorMessage(error) });
      }
    }
  },

  grantConsent: async () => {
    const before = get();
    if (!before.workspaceRoot || before.workspaceGeneration === null) {
      throw new Error("Open a Workspace before enabling AI Access.");
    }
    const { workspaceRoot, workspaceGeneration } = before;
    const status = await grantAiAccessConsent(workspaceRoot);
    const current = get();
    if (
      current.workspaceRoot !== workspaceRoot ||
      current.workspaceGeneration !== workspaceGeneration ||
      status.workspaceRoot !== workspaceRoot ||
      !status.granted
    ) {
      throw new Error("The Workspace changed before AI Access could be enabled.");
    }
    set({ consent: "granted", error: null });
  },

  selectAgent: (id) => set({ selectedAgentId: id }),

  setTurnBridgeReady: (workspaceRoot, workspaceGeneration, ready) => {
    const current = get();
    if (
      current.workspaceRoot === workspaceRoot &&
      current.workspaceGeneration === workspaceGeneration
    ) {
      set({ turnBridgeReady: ready });
    }
  },

  reportTurnBridgeFailure: (workspaceRoot, workspaceGeneration, message) => {
    const current = get();
    if (
      current.workspaceRoot === workspaceRoot &&
      current.workspaceGeneration === workspaceGeneration
    ) {
      set({
        turnBridgeReady: false,
        error: `Could not connect the Agent Turn lifecycle: ${message}`,
      });
    }
  },

  send: async (prompt) => {
    const before = get();
    if (!before.turnBridgeReady) {
      throw new Error("The Agent Turn lifecycle is still connecting.");
    }
    if (before.conversation) {
      if (!isTerminal(before.conversation.status)) {
        throw new Error("An Agent Turn is already active; Writer does not queue sends.");
      }
      throw new Error("This Workspace already has its temporary Conversation for this session.");
    }
    if (!before.workspaceRoot || before.workspaceGeneration === null) {
      throw new Error("Open a Workspace before sending to an Agent.");
    }
    if (before.consent !== "granted") {
      throw new Error("Enable AI Access for this Workspace before sending.");
    }
    if (!before.selectedAgentId) {
      throw new Error("Choose a compatible Agent before sending.");
    }
    const trimmed = prompt.trim();
    if (!trimmed) throw new Error("Enter a prompt before sending.");
    const { workspaceRoot, workspaceGeneration, selectedAgentId, registrationRevision } = before;
    const conversationId = globalThis.crypto.randomUUID();
    set({
      conversation: {
        id: conversationId,
        turnId: null,
        prompt: trimmed,
        output: "",
        changeSummaries: [],
        status: "starting",
        message: null,
        reconciliation: null,
        permission: null,
      },
      error: null,
    });
    try {
      const started = await startAgentTurn(
        workspaceRoot,
        selectedAgentId,
        registrationRevision,
        conversationId,
        trimmed,
      );
      const current = get();
      if (
        current.workspaceRoot !== workspaceRoot ||
        current.workspaceGeneration !== workspaceGeneration ||
        current.conversation?.id !== conversationId
      ) {
        return;
      }
      set({
        conversation: {
          ...current.conversation,
          turnId: started.turnId,
          status:
            current.conversation.status === "starting" ? "preparing" : current.conversation.status,
        },
      });
    } catch (error) {
      const current = get();
      if (current.conversation?.id === conversationId) {
        set({
          conversation: {
            ...current.conversation,
            status: "failed",
            message: errorMessage(error),
          },
        });
      }
      throw error;
    }
  },

  receiveTurnEvent: (event) => {
    const current = get();
    const conversation = current.conversation;
    if (
      !conversation ||
      current.workspaceRoot !== event.workspaceRoot ||
      conversation.id !== event.conversationId ||
      (conversation.turnId !== null && conversation.turnId !== event.turnId)
    ) {
      return;
    }
    if (event.type === "phase") {
      const status =
        event.phase === "running"
          ? "running"
          : event.phase === "awaiting-permission"
            ? "awaiting-permission"
            : event.phase === "reconciling"
              ? "reconciling"
              : conversation.status;
      set({
        conversation: {
          ...conversation,
          turnId: event.turnId,
          status,
          permission: event.phase === "running" ? null : conversation.permission,
        },
      });
    } else if (event.type === "stream-text") {
      set({
        conversation: {
          ...conversation,
          turnId: event.turnId,
          status: "running",
          output: conversation.output + event.text,
        },
      });
    } else if (event.type === "change-summary") {
      set({
        conversation: {
          ...conversation,
          turnId: event.turnId,
          changeSummaries: conversation.changeSummaries.includes(event.summary)
            ? conversation.changeSummaries
            : [...conversation.changeSummaries, event.summary],
        },
      });
    } else if (event.type === "permission") {
      set({
        conversation: {
          ...conversation,
          turnId: event.turnId,
          status: "awaiting-permission",
          permission: {
            requestId: event.requestId,
            title: event.title,
            options: event.options,
            responding: false,
          },
        },
      });
    } else if (event.type === "reconciliation-blocked") {
      set({
        conversation: {
          ...conversation,
          turnId: event.turnId,
          status: "reconciliation-blocked",
          message: event.message,
          permission: null,
        },
      });
    } else if (event.type === "terminal") {
      set({
        conversation: {
          ...conversation,
          turnId: event.turnId,
          status: event.status,
          message: event.message,
          permission: null,
        },
      });
    }
  },

  recordReconciliation: (workspaceRoot, workspaceGeneration, conversationId, outcome) => {
    const current = get();
    const conversation = current.conversation;
    if (
      !conversation ||
      current.workspaceRoot !== workspaceRoot ||
      current.workspaceGeneration !== workspaceGeneration ||
      conversation.id !== conversationId
    ) {
      return;
    }
    set({ conversation: { ...conversation, reconciliation: outcome } });
  },

  respondPermission: async (optionId) => {
    const current = get();
    const conversation = current.conversation;
    const permission = conversation?.permission;
    if (!current.workspaceRoot || !conversation?.turnId || !permission) {
      throw new Error("There is no active Agent permission request.");
    }
    if (permission.responding) {
      throw new Error("That permission decision is already being sent.");
    }
    if (optionId !== null && !permission.options.some((option) => option.id === optionId)) {
      throw new Error("The selected permission option is stale.");
    }
    set({
      conversation: {
        ...conversation,
        permission: { ...permission, responding: true },
      },
    });
    try {
      await respondAgentTurnPermission(
        current.workspaceRoot,
        conversation.turnId,
        permission.requestId,
        optionId,
      );
      const latest = get().conversation;
      if (latest?.permission?.requestId === permission.requestId) {
        set({ conversation: { ...latest, permission: null, status: "running" } });
      }
    } catch (error) {
      const latest = get().conversation;
      if (latest?.permission?.requestId === permission.requestId) {
        set({
          conversation: {
            ...latest,
            permission: { ...latest.permission, responding: false },
          },
        });
      }
      throw error;
    }
  },
}));

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTerminal(status: AssistantTurnStatus) {
  return status === "completed" || status === "failed";
}

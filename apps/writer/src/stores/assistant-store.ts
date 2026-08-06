import { create } from "zustand";
import {
  addAgentRegistration,
  cancelAgentDiscovery,
  discoverAgentRuntimes,
  removeAgentRegistration,
  getAiAccessConsent,
  grantAiAccessConsent,
  listAssistantConversations,
  createAssistantConversation,
  renameAssistantConversation,
  selectAssistantConversation,
  deleteAssistantConversation,
  rememberAssistantAgent,
  startAgentTurn,
  respondAgentTurnPermission,
  type AgentTurnEvent,
  type AgentDiscovery,
  type ConversationRecord,
  type ConversationSummary,
  type ConversationRestoreStatus,
} from "@/platform/tauri/assistant";
import type { WorkspaceReconciliationOutcome } from "@/domain/workspace-turn-lifecycle";

export type AssistantDiscoveryPhase = "idle" | "loading" | "ready" | "error";
export type AssistantConsent = "unknown" | "loading" | "required" | "granted";
export type AssistantTurnStatus =
  | "idle"
  | "starting"
  | "preparing"
  | "running"
  | "awaiting-permission"
  | "reconciling"
  | "reconciliation-blocked"
  | "completed"
  | "failed";

export interface ActiveAssistantConversation {
  id: string;
  name: string;
  agentId: string;
  restoreStatus: ConversationRestoreStatus;
  runtimeSessionId: string | null;
  messages: ConversationRecord["messages"];
  turns: ConversationRecord["turns"];
  /** Ephemeral projection of the in-flight turn; cleared after terminal. */
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
  lastAgentId: string | null;
  turnBridgeReady: boolean;
  conversations: ConversationSummary[];
  conversationRevision: number;
  conversation: ActiveAssistantConversation | null;
  conversationsLoading: boolean;

  activateWorkspace: (workspaceRoot: string, workspaceGeneration: number) => void;
  deactivateWorkspace: () => void;
  refresh: () => Promise<void>;
  addCustom: (command: string, args: string[]) => Promise<void>;
  removeCustom: (id: string) => Promise<void>;
  loadConsent: () => Promise<void>;
  grantConsent: () => Promise<void>;
  selectAgent: (id: string) => void;
  loadConversations: () => Promise<void>;
  createConversation: (name?: string) => Promise<void>;
  renameConversation: (conversationId: string, name: string) => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
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
  lastAgentId: null,
  turnBridgeReady: false,
  conversations: [] as ConversationSummary[],
  conversationRevision: 0,
  conversation: null as ActiveAssistantConversation | null,
  conversationsLoading: false,
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
      const compatible = response.agents.filter((agent) => agent.status === "compatible");
      const compatibleAgentIds = new Set(compatible.map((agent) => agent.id));
      const preferred =
        (current.selectedAgentId && compatibleAgentIds.has(current.selectedAgentId)
          ? current.selectedAgentId
          : null) ??
        (current.lastAgentId && compatibleAgentIds.has(current.lastAgentId)
          ? current.lastAgentId
          : null) ??
        (compatible.length === 1 ? compatible[0].id : (compatible[0]?.id ?? null));
      set({
        phase: "ready",
        agents: response.agents,
        selectedAgentId: preferred,
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
    if (conversation && isActiveTurn(conversation.status)) {
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
    if (conversation && isActiveTurn(conversation.status)) {
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

  selectAgent: (id) => {
    set({ selectedAgentId: id });
    const { workspaceRoot, conversation } = get();
    if (!workspaceRoot || conversation) return;
    void rememberAssistantAgent(workspaceRoot, id).catch((error: unknown) => {
      console.error("Could not remember the selected Agent", error);
    });
  },

  loadConversations: async () => {
    const before = get();
    if (!before.workspaceRoot || before.workspaceGeneration === null) return;
    const { workspaceRoot, workspaceGeneration } = before;
    set({ conversationsLoading: true });
    try {
      const snapshot = await listAssistantConversations(workspaceRoot);
      const current = get();
      if (
        current.workspaceRoot !== workspaceRoot ||
        current.workspaceGeneration !== workspaceGeneration ||
        snapshot.workspaceRoot !== workspaceRoot
      ) {
        return;
      }
      const active = snapshot.activeConversation
        ? projectRecord(snapshot.activeConversation)
        : null;
      const compatible = current.agents.filter((agent) => agent.status === "compatible");
      const preferredAgent =
        active?.agentId ??
        (snapshot.lastAgentId && compatible.some((agent) => agent.id === snapshot.lastAgentId)
          ? snapshot.lastAgentId
          : null) ??
        current.selectedAgentId ??
        (compatible.length === 1 ? compatible[0].id : (compatible[0]?.id ?? null));
      set({
        conversations: snapshot.conversations,
        conversationRevision: snapshot.revision,
        conversation: active,
        lastAgentId: snapshot.lastAgentId,
        selectedAgentId: preferredAgent,
        conversationsLoading: false,
        error: null,
      });
    } catch (error) {
      const current = get();
      if (
        current.workspaceRoot === workspaceRoot &&
        current.workspaceGeneration === workspaceGeneration
      ) {
        set({ conversationsLoading: false, error: errorMessage(error) });
      }
    }
  },

  createConversation: async (name) => {
    const before = get();
    if (!before.workspaceRoot || before.workspaceGeneration === null) {
      throw new Error("Open a Workspace before creating an Assistant Conversation.");
    }
    if (before.conversation && isActiveTurn(before.conversation.status)) {
      throw new Error("Finish the active Agent Turn before creating another Conversation.");
    }
    const compatible = before.agents.filter((agent) => agent.status === "compatible");
    if (compatible.length === 0) {
      throw new Error("Choose a compatible Agent before creating a Conversation.");
    }
    let agentId = before.selectedAgentId;
    if (!agentId || !compatible.some((agent) => agent.id === agentId)) {
      if (compatible.length === 1) {
        agentId = compatible[0].id;
      } else if (
        before.lastAgentId &&
        compatible.some((agent) => agent.id === before.lastAgentId)
      ) {
        agentId = before.lastAgentId;
      } else {
        throw new Error("Choose which compatible Agent this Conversation should bind permanently.");
      }
    }
    const { workspaceRoot, workspaceGeneration } = before;
    const record = await createAssistantConversation(workspaceRoot, agentId, name ?? null);
    const current = get();
    if (
      current.workspaceRoot !== workspaceRoot ||
      current.workspaceGeneration !== workspaceGeneration
    ) {
      return;
    }
    set({
      conversation: projectRecord(record),
      selectedAgentId: record.agentId,
      lastAgentId: record.agentId,
      conversations: [
        {
          id: record.id,
          workspaceRoot: record.workspaceRoot,
          agentId: record.agentId,
          name: record.name,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          restoreStatus: record.restoreStatus,
        },
        ...current.conversations.filter((item) => item.id !== record.id),
      ],
      conversationRevision: current.conversationRevision + 1,
      error: null,
    });
  },

  renameConversation: async (conversationId, name) => {
    const before = get();
    if (!before.workspaceRoot || before.workspaceGeneration === null) return;
    const { workspaceRoot, workspaceGeneration } = before;
    const record = await renameAssistantConversation(workspaceRoot, conversationId, name);
    const current = get();
    if (
      current.workspaceRoot !== workspaceRoot ||
      current.workspaceGeneration !== workspaceGeneration
    ) {
      return;
    }
    set({
      conversation:
        current.conversation?.id === conversationId
          ? { ...current.conversation, name: record.name }
          : current.conversation,
      conversations: current.conversations.map((item) =>
        item.id === conversationId ? { ...item, name: record.name } : item,
      ),
    });
  },

  selectConversation: async (conversationId) => {
    const before = get();
    if (!before.workspaceRoot || before.workspaceGeneration === null) return;
    if (before.conversation && isActiveTurn(before.conversation.status)) {
      throw new Error("Finish the active Agent Turn before switching Conversations.");
    }
    const { workspaceRoot, workspaceGeneration } = before;
    const record = await selectAssistantConversation(workspaceRoot, conversationId);
    const current = get();
    if (
      current.workspaceRoot !== workspaceRoot ||
      current.workspaceGeneration !== workspaceGeneration
    ) {
      return;
    }
    set({
      conversation: projectRecord(record),
      selectedAgentId: record.agentId,
      lastAgentId: record.agentId,
      error: null,
    });
  },

  deleteConversation: async (conversationId) => {
    const before = get();
    if (!before.workspaceRoot || before.workspaceGeneration === null) return;
    if (before.conversation?.id === conversationId && isActiveTurn(before.conversation.status)) {
      throw new Error("Finish the active Agent Turn before deleting this Conversation.");
    }
    const { workspaceRoot, workspaceGeneration } = before;
    const snapshot = await deleteAssistantConversation(workspaceRoot, conversationId);
    const current = get();
    if (
      current.workspaceRoot !== workspaceRoot ||
      current.workspaceGeneration !== workspaceGeneration
    ) {
      return;
    }
    set({
      conversations: snapshot.conversations,
      conversationRevision: snapshot.revision,
      conversation: snapshot.activeConversation ? projectRecord(snapshot.activeConversation) : null,
      lastAgentId: snapshot.lastAgentId,
      selectedAgentId:
        snapshot.activeConversation?.agentId ?? snapshot.lastAgentId ?? current.selectedAgentId,
      error: null,
    });
  },

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
    if (before.conversation && isActiveTurn(before.conversation.status)) {
      throw new Error("An Agent Turn is already active; Writer does not queue sends.");
    }
    if (!before.workspaceRoot || before.workspaceGeneration === null) {
      throw new Error("Open a Workspace before sending to an Agent.");
    }
    if (before.consent !== "granted") {
      throw new Error("Enable AI Access for this Workspace before sending.");
    }
    const trimmed = prompt.trim();
    if (!trimmed) throw new Error("Enter a prompt before sending.");

    let conversation = before.conversation;
    if (!conversation) {
      await get().createConversation();
      conversation = get().conversation;
      if (!conversation) {
        throw new Error("Could not create an Assistant Conversation for this send.");
      }
    }
    if (conversation.restoreStatus === "failed") {
      throw new Error(
        "This Conversation cannot resume its Runtime session; create a new Conversation instead of replaying history.",
      );
    }
    const { workspaceRoot, workspaceGeneration, registrationRevision } = get();
    if (!workspaceRoot || workspaceGeneration === null) {
      throw new Error("Open a Workspace before sending to an Agent.");
    }
    const conversationId = conversation.id;
    const agentId = conversation.agentId;
    set({
      conversation: {
        ...conversation,
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
        agentId,
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
      const nextMessages = [...conversation.messages];
      if (conversation.prompt) {
        nextMessages.push({
          id: `local-user-${event.turnId}`,
          role: "user",
          content: conversation.prompt,
          citations: [],
          createdAt: Date.now(),
        });
      }
      if (conversation.output || event.message) {
        nextMessages.push({
          id: `local-assistant-${event.turnId}`,
          role: "assistant",
          content: conversation.output || event.message,
          citations: [],
          createdAt: Date.now(),
        });
      }
      set({
        conversation: {
          ...conversation,
          turnId: event.turnId,
          status: event.status,
          message: event.message,
          permission: null,
          messages: nextMessages,
          changeSummaries: conversation.changeSummaries,
          restoreStatus:
            event.status === "failed" && event.message.includes("resume the Runtime session")
              ? "failed"
              : conversation.restoreStatus === "none"
                ? "active"
                : conversation.restoreStatus,
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

function projectRecord(record: ConversationRecord): ActiveAssistantConversation {
  return {
    id: record.id,
    name: record.name,
    agentId: record.agentId,
    restoreStatus: record.restoreStatus,
    runtimeSessionId: record.runtimeSessionId,
    messages: record.messages,
    turns: record.turns,
    turnId: null,
    prompt: "",
    output: "",
    changeSummaries: [],
    status: "idle",
    message: null,
    reconciliation: null,
    permission: null,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isActiveTurn(status: AssistantTurnStatus) {
  return (
    status === "starting" ||
    status === "preparing" ||
    status === "running" ||
    status === "awaiting-permission" ||
    status === "reconciling" ||
    status === "reconciliation-blocked"
  );
}

export function isAssistantConversationActive(conversation: ActiveAssistantConversation | null) {
  return conversation !== null && isActiveTurn(conversation.status);
}

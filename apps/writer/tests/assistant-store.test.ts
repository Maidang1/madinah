import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("../src/platform/tauri/assistant", () => ({
  discoverAgentRuntimes: vi.fn(),
  cancelAgentDiscovery: vi.fn(),
  addAgentRegistration: vi.fn(),
  removeAgentRegistration: vi.fn(),
  getAiAccessConsent: vi.fn(),
  grantAiAccessConsent: vi.fn(),
  listAssistantConversations: vi.fn(),
  createAssistantConversation: vi.fn(),
  renameAssistantConversation: vi.fn(),
  selectAssistantConversation: vi.fn(),
  deleteAssistantConversation: vi.fn(),
  rememberAssistantAgent: vi.fn(),
  startAgentTurn: vi.fn(),
  respondAgentTurnPermission: vi.fn(),
}));

import * as assistantApi from "../src/platform/tauri/assistant";
import type {
  AgentDiscovery,
  AgentDiscoveryResponse,
  ConversationRecord,
  WorkspaceConversationSnapshot,
} from "../src/platform/tauri/assistant";
import { useAssistantStore } from "../src/stores/assistant-store";

const discover = vi.mocked(assistantApi.discoverAgentRuntimes);
const listConversations = vi.mocked(assistantApi.listAssistantConversations);
const createConversation = vi.mocked(assistantApi.createAssistantConversation);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function response(workspaceRoot: string, revision = 0): AgentDiscoveryResponse {
  return {
    workspaceRoot,
    registrationRevision: revision,
    registrationError: null,
    agents: [],
  };
}

function compatibleAgent(id: string): AgentDiscovery {
  return {
    id,
    name: id,
    source: "built-in",
    command: id,
    args: [],
    setupUrl: "https://example.com/setup",
    capabilities: {
      streamedText: "protocol-baseline",
      sessionCreate: "protocol-baseline",
      sessionRestore: "advertised",
      cancellation: "protocol-baseline",
      workspaceCwd: "protocol-baseline",
      permissionRequests: "protocol-baseline",
    },
    status: "compatible",
    message: "Ready",
    missingCapabilities: [],
    agentInfo: null,
    authMethods: [],
  };
}

function emptySnapshot(workspaceRoot: string): WorkspaceConversationSnapshot {
  return {
    workspaceRoot,
    revision: 0,
    conversations: [],
    activeConversationId: null,
    lastAgentId: null,
    activeConversation: null,
  };
}

function record(
  workspaceRoot: string,
  id: string,
  agentId: string,
  overrides: Partial<ConversationRecord> = {},
): ConversationRecord {
  return {
    version: 1,
    id,
    workspaceRoot,
    agentId,
    name: "Conversation",
    createdAt: 1,
    updatedAt: 1,
    runtimeSessionId: null,
    restoreStatus: "none",
    messages: [],
    turns: [],
    ...overrides,
  };
}

describe("Assistant discovery store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assistantApi.cancelAgentDiscovery).mockResolvedValue(1);
    vi.mocked(assistantApi.rememberAssistantAgent).mockResolvedValue();
    listConversations.mockResolvedValue(emptySnapshot("/workspace"));
    useAssistantStore.getState().deactivateWorkspace();
    vi.clearAllMocks();
    vi.mocked(assistantApi.cancelAgentDiscovery).mockResolvedValue(1);
    vi.mocked(assistantApi.rememberAssistantAgent).mockResolvedValue();
    listConversations.mockResolvedValue(emptySnapshot("/workspace"));
  });

  test("deactivation invalidates local state and cancels backend discovery", () => {
    useAssistantStore.getState().activateWorkspace("/workspace", 1);

    useAssistantStore.getState().deactivateWorkspace();

    expect(assistantApi.cancelAgentDiscovery).toHaveBeenCalledOnce();
    expect(useAssistantStore.getState()).toMatchObject({
      phase: "idle",
      workspaceRoot: null,
      workspaceGeneration: null,
      agents: [],
      conversations: [],
      conversation: null,
    });
  });

  test("drops a discovery response after the Workspace identity changes", async () => {
    const pending = deferred<AgentDiscoveryResponse>();
    discover.mockReturnValue(pending.promise);
    useAssistantStore.getState().activateWorkspace("/workspace-a", 1);

    const refresh = useAssistantStore.getState().refresh();
    useAssistantStore.getState().activateWorkspace("/workspace-b", 2);
    pending.resolve(response("/workspace-a"));
    await refresh;

    expect(useAssistantStore.getState()).toMatchObject({
      phase: "idle",
      workspaceRoot: "/workspace-b",
      workspaceGeneration: 2,
      agents: [],
    });
  });

  test("drops an older response when a newer refresh wins", async () => {
    const first = deferred<AgentDiscoveryResponse>();
    const second = deferred<AgentDiscoveryResponse>();
    discover.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    useAssistantStore.getState().activateWorkspace("/workspace", 1);

    const older = useAssistantStore.getState().refresh();
    const newer = useAssistantStore.getState().refresh();
    second.resolve(response("/workspace", 2));
    await newer;
    first.resolve(response("/workspace", 1));
    await older;

    expect(useAssistantStore.getState()).toMatchObject({
      phase: "ready",
      registrationRevision: 2,
    });
  });

  test("selects the first compatible Agent as part of the discovery action", async () => {
    discover.mockResolvedValue({
      ...response("/workspace"),
      agents: [compatibleAgent("first"), compatibleAgent("second")],
    });
    useAssistantStore.getState().activateWorkspace("/workspace", 1);

    await useAssistantStore.getState().refresh();

    expect(useAssistantStore.getState().selectedAgentId).toBe("first");
  });

  test("restores the last remembered Agent when several compatible Agents exist", async () => {
    listConversations.mockResolvedValue({
      ...emptySnapshot("/workspace"),
      lastAgentId: "second",
    });
    discover.mockResolvedValue({
      ...response("/workspace"),
      agents: [compatibleAgent("first"), compatibleAgent("second")],
    });
    useAssistantStore.getState().activateWorkspace("/workspace", 1);
    await useAssistantStore.getState().refresh();
    await useAssistantStore.getState().loadConversations();

    expect(useAssistantStore.getState().selectedAgentId).toBe("second");
    expect(useAssistantStore.getState().lastAgentId).toBe("second");
  });

  test("keeps consent and conversations scoped to one Workspace generation", async () => {
    vi.mocked(assistantApi.getAiAccessConsent).mockResolvedValue({
      granted: true,
      workspaceRoot: "/workspace-a",
      revision: 4,
    });
    listConversations.mockResolvedValue({
      ...emptySnapshot("/workspace-a"),
      conversations: [
        {
          id: "c1",
          workspaceRoot: "/workspace-a",
          agentId: "agent-a",
          name: "One",
          createdAt: 1,
          updatedAt: 1,
          restoreStatus: "none",
        },
      ],
      activeConversationId: "c1",
      activeConversation: record("/workspace-a", "c1", "agent-a", { name: "One" }),
    });
    useAssistantStore.getState().activateWorkspace("/workspace-a", 1);
    await useAssistantStore.getState().loadConsent();
    await useAssistantStore.getState().loadConversations();
    useAssistantStore.getState().selectAgent("agent-a");

    expect(useAssistantStore.getState()).toMatchObject({
      consent: "granted",
      selectedAgentId: "agent-a",
      conversation: { id: "c1" },
    });

    useAssistantStore.getState().activateWorkspace("/workspace-b", 2);

    expect(useAssistantStore.getState()).toMatchObject({
      consent: "unknown",
      selectedAgentId: null,
      conversation: null,
      conversations: [],
    });
  });

  test("allows multi-turn sends on a durable conversation and refuses concurrent turns", async () => {
    createConversation.mockResolvedValue(record("/workspace", "conv-1", "agent"));
    vi.mocked(assistantApi.startAgentTurn).mockResolvedValue({
      turnId: "turn-1",
      conversationId: "conv-1",
      workspaceRoot: "/workspace",
    });
    useAssistantStore.getState().activateWorkspace("/workspace", 3);
    useAssistantStore.setState({
      consent: "granted",
      turnBridgeReady: true,
      selectedAgentId: "agent",
      registrationRevision: 7,
      agents: [compatibleAgent("agent")],
    });
    await useAssistantStore.getState().createConversation();
    expect(useAssistantStore.getState().conversation?.id).toBe("conv-1");

    await useAssistantStore.getState().send("Make a change");
    const conversationId = useAssistantStore.getState().conversation!.id;
    expect(conversationId).toBe("conv-1");
    await expect(useAssistantStore.getState().send("Queue this")).rejects.toThrow("already active");
    useAssistantStore.getState().receiveTurnEvent({
      type: "stream-text",
      turnId: "turn-1",
      conversationId,
      workspaceRoot: "/workspace",
      text: "Done",
    });
    expect(useAssistantStore.getState().conversation?.status).toBe("running");
    useAssistantStore.getState().receiveTurnEvent({
      type: "change-summary",
      turnId: "turn-1",
      conversationId,
      workspaceRoot: "/workspace",
      summary: "Updated note.md",
    });
    useAssistantStore.getState().receiveTurnEvent({
      type: "terminal",
      turnId: "turn-1",
      conversationId,
      workspaceRoot: "/workspace",
      status: "completed",
      message: "Done",
    });
    expect(useAssistantStore.getState().conversation?.status).toBe("completed");

    vi.mocked(assistantApi.startAgentTurn).mockResolvedValue({
      turnId: "turn-2",
      conversationId: "conv-1",
      workspaceRoot: "/workspace",
    });
    await useAssistantStore.getState().send("Second turn");
    expect(useAssistantStore.getState().conversation?.status).toBe("preparing");
    expect(assistantApi.startAgentTurn).toHaveBeenLastCalledWith(
      "/workspace",
      "agent",
      7,
      "conv-1",
      "Second turn",
    );
  });

  test("refuses sends when runtime restore failed and keeps the transcript", async () => {
    useAssistantStore.getState().activateWorkspace("/workspace", 3);
    useAssistantStore.setState({
      consent: "granted",
      turnBridgeReady: true,
      selectedAgentId: "agent",
      conversation: {
        id: "conv-1",
        name: "Broken",
        agentId: "agent",
        restoreStatus: "failed",
        runtimeSessionId: "session-1",
        messages: [
          {
            id: "m1",
            role: "user",
            content: "Earlier",
            citations: [],
            createdAt: 1,
          },
        ],
        turns: [],
        turnId: null,
        prompt: "",
        output: "",
        changeSummaries: [],
        status: "idle",
        message: null,
        reconciliation: null,
        permission: null,
      },
    });

    await expect(useAssistantStore.getState().send("Again")).rejects.toThrow(
      "create a new Conversation",
    );
    expect(useAssistantStore.getState().conversation?.messages).toHaveLength(1);
    expect(assistantApi.startAgentTurn).not.toHaveBeenCalled();
  });

  test("keeps blocked reconciliation active and ignores stale reconciliation outcomes", async () => {
    createConversation.mockResolvedValue(record("/workspace", "conv-1", "agent"));
    vi.mocked(assistantApi.startAgentTurn).mockResolvedValue({
      turnId: "turn-1",
      conversationId: "conv-1",
      workspaceRoot: "/workspace",
    });
    useAssistantStore.getState().activateWorkspace("/workspace", 3);
    useAssistantStore.setState({
      consent: "granted",
      turnBridgeReady: true,
      selectedAgentId: "agent",
      agents: [compatibleAgent("agent")],
    });
    await useAssistantStore.getState().createConversation();
    await useAssistantStore.getState().send("Make a change");
    const conversationId = useAssistantStore.getState().conversation!.id;
    expect(conversationId).toBe("conv-1");

    useAssistantStore.getState().receiveTurnEvent({
      type: "reconciliation-blocked",
      turnId: "turn-1",
      conversationId,
      workspaceRoot: "/workspace",
      message: "Reload failed; editing remains locked.",
    });
    expect(useAssistantStore.getState().conversation).toMatchObject({
      status: "reconciliation-blocked",
      message: "Reload failed; editing remains locked.",
    });
    await expect(useAssistantStore.getState().send("Queue this")).rejects.toThrow("already active");

    useAssistantStore
      .getState()
      .recordReconciliation("/other-workspace", 99, "other-conversation", {
        status: "completed",
        fileCount: 1,
        failures: [],
      });
    expect(useAssistantStore.getState().conversation?.reconciliation).toBeNull();
    useAssistantStore.getState().recordReconciliation("/workspace", 3, conversationId, {
      status: "failed",
      failures: [{ phase: "read", path: "/workspace/a.md", message: "denied" }],
    });
    expect(useAssistantStore.getState().conversation?.reconciliation?.status).toBe("failed");
  });

  test("keeps early phases and sends each permission decision only once", async () => {
    createConversation.mockResolvedValue(record("/workspace", "conv-fast", "agent"));
    const started = deferred<{
      turnId: string;
      conversationId: string;
      workspaceRoot: string;
    }>();
    const permissionResponse = deferred<void>();
    vi.mocked(assistantApi.startAgentTurn).mockReturnValue(started.promise);
    vi.mocked(assistantApi.respondAgentTurnPermission).mockReturnValue(permissionResponse.promise);
    useAssistantStore.getState().activateWorkspace("/workspace", 4);
    useAssistantStore.setState({
      consent: "granted",
      turnBridgeReady: true,
      selectedAgentId: "agent",
      registrationRevision: 8,
      agents: [compatibleAgent("agent")],
    });
    await useAssistantStore.getState().createConversation();
    const conversationId = useAssistantStore.getState().conversation!.id;
    expect(conversationId).toBe("conv-fast");

    const send = useAssistantStore.getState().send("Run it");
    expect(useAssistantStore.getState().conversation?.status).toBe("starting");
    useAssistantStore.getState().receiveTurnEvent({
      type: "phase",
      turnId: "turn-fast",
      conversationId,
      workspaceRoot: "/workspace",
      phase: "running",
    });
    started.resolve({ turnId: "turn-fast", conversationId, workspaceRoot: "/workspace" });
    await send;
    expect(useAssistantStore.getState().conversation?.status).toBe("running");

    useAssistantStore.getState().receiveTurnEvent({
      type: "permission",
      turnId: "turn-fast",
      conversationId,
      workspaceRoot: "/workspace",
      requestId: "permission-1",
      title: "Run a tool?",
      options: [{ id: "allow", name: "Allow once", kind: "allow_once" }],
    });
    expect(useAssistantStore.getState().conversation?.status).toBe("awaiting-permission");

    useAssistantStore.getState().receiveTurnEvent({
      type: "phase",
      turnId: "turn-fast",
      conversationId,
      workspaceRoot: "/workspace",
      phase: "running",
    });
    expect(useAssistantStore.getState().conversation).toMatchObject({
      status: "running",
      permission: null,
    });

    useAssistantStore.getState().receiveTurnEvent({
      type: "permission",
      turnId: "turn-fast",
      conversationId,
      workspaceRoot: "/workspace",
      requestId: "permission-1",
      title: "Run a tool?",
      options: [{ id: "allow", name: "Allow once", kind: "allow_once" }],
    });

    const response = useAssistantStore.getState().respondPermission("allow");
    await expect(useAssistantStore.getState().respondPermission("allow")).rejects.toThrow(
      "already being sent",
    );
    expect(assistantApi.respondAgentTurnPermission).toHaveBeenCalledWith(
      "/workspace",
      "turn-fast",
      "permission-1",
      "allow",
    );
    permissionResponse.resolve();
    await response;
    expect(useAssistantStore.getState().conversation).toMatchObject({
      status: "running",
      permission: null,
    });
  });

  test("refuses to send before the Workspace lifecycle bridge is ready", async () => {
    useAssistantStore.getState().activateWorkspace("/workspace", 5);
    useAssistantStore.setState({ consent: "granted", selectedAgentId: "agent" });

    await expect(useAssistantStore.getState().send("Too early")).rejects.toThrow(
      "lifecycle is still connecting",
    );
    expect(assistantApi.startAgentTurn).not.toHaveBeenCalled();
  });
});

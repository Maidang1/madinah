import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("../src/platform/tauri/assistant", () => ({
  discoverAgentRuntimes: vi.fn(),
  cancelAgentDiscovery: vi.fn(),
  addAgentRegistration: vi.fn(),
  removeAgentRegistration: vi.fn(),
  getAiAccessConsent: vi.fn(),
  grantAiAccessConsent: vi.fn(),
  startAgentTurn: vi.fn(),
  respondAgentTurnPermission: vi.fn(),
}));

import * as assistantApi from "../src/platform/tauri/assistant";
import type { AgentDiscovery, AgentDiscoveryResponse } from "../src/platform/tauri/assistant";
import { useAssistantStore } from "../src/stores/assistant-store";

const discover = vi.mocked(assistantApi.discoverAgentRuntimes);

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

describe("Assistant discovery store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(assistantApi.cancelAgentDiscovery).mockResolvedValue(1);
    useAssistantStore.getState().deactivateWorkspace();
    vi.clearAllMocks();
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

  test("keeps consent and the temporary conversation scoped to one Workspace generation", async () => {
    vi.mocked(assistantApi.getAiAccessConsent).mockResolvedValue({
      granted: true,
      workspaceRoot: "/workspace-a",
      revision: 4,
    });
    useAssistantStore.getState().activateWorkspace("/workspace-a", 1);
    await useAssistantStore.getState().loadConsent();
    useAssistantStore.getState().selectAgent("agent-a");

    expect(useAssistantStore.getState()).toMatchObject({
      consent: "granted",
      selectedAgentId: "agent-a",
    });

    useAssistantStore.getState().activateWorkspace("/workspace-b", 2);

    expect(useAssistantStore.getState()).toMatchObject({
      consent: "unknown",
      selectedAgentId: null,
      conversation: null,
    });
  });

  test("starts exactly one temporary conversation and refuses later sends", async () => {
    vi.mocked(assistantApi.startAgentTurn).mockImplementation(
      async (_root, _agent, _revision, conversationId) => ({
        turnId: "turn-1",
        conversationId,
        workspaceRoot: "/workspace",
      }),
    );
    useAssistantStore.getState().activateWorkspace("/workspace", 3);
    useAssistantStore.setState({
      consent: "granted",
      turnBridgeReady: true,
      selectedAgentId: "agent",
      registrationRevision: 7,
    });

    await useAssistantStore.getState().send("Make a change");
    const conversationId = useAssistantStore.getState().conversation!.id;
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
    await expect(useAssistantStore.getState().send("Start another")).rejects.toThrow(
      "already has its temporary Conversation",
    );

    expect(useAssistantStore.getState().conversation).toMatchObject({
      turnId: "turn-1",
      prompt: "Make a change",
      output: "Done",
      changeSummaries: ["Updated note.md"],
      status: "completed",
    });
  });

  test("keeps blocked reconciliation active and ignores stale reconciliation outcomes", async () => {
    vi.mocked(assistantApi.startAgentTurn).mockImplementation(
      async (_root, _agent, _revision, conversationId) => ({
        turnId: "turn-1",
        conversationId,
        workspaceRoot: "/workspace",
      }),
    );
    useAssistantStore.getState().activateWorkspace("/workspace", 3);
    useAssistantStore.setState({
      consent: "granted",
      turnBridgeReady: true,
      selectedAgentId: "agent",
    });
    await useAssistantStore.getState().send("Make a change");
    const conversationId = useAssistantStore.getState().conversation!.id;

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
    });

    const send = useAssistantStore.getState().send("Run it");
    const conversationId = useAssistantStore.getState().conversation!.id;
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

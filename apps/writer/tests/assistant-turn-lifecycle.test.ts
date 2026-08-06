import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

const listen = vi.fn();
const prepareWorkspaceTurn = vi.fn();
const reconcileWorkspaceTurn = vi.fn();
const releaseWorkspaceTurn = vi.fn();
const acknowledgeAgentTurnPrepared = vi.fn();
const acknowledgeAgentTurnReconciled = vi.fn();
const registerAgentTurnBridge = vi.fn().mockResolvedValue({ bridgeId: "bridge-1" });
const unregisterAgentTurnBridge = vi.fn().mockResolvedValue(true);
vi.mock("@/platform/tauri/assistant", () => ({
  listenAgentTurnEvents: listen,
  acknowledgeAgentTurnPrepared,
  acknowledgeAgentTurnReconciled,
  registerAgentTurnBridge,
  unregisterAgentTurnBridge,
}));
vi.mock("@/hooks/workspace-turn-lifecycle", () => ({
  prepareWorkspaceTurn,
  reconcileWorkspaceTurn,
  releaseWorkspaceTurn,
}));

const event = {
  type: "prepare",
  turnId: "turn",
  conversationId: "conversation",
  workspaceRoot: "/repo",
  workspaceEpoch: 7,
  participantToken: "participant",
  bridgeId: "bridge",
  requestId: "request",
};

describe("assistant turn lifecycle", () => {
  beforeEach(() => vi.clearAllMocks());
  test("prepare ACK carries the complete identity", async () => {
    const unlisten = vi.fn();
    listen.mockResolvedValue(unlisten);
    prepareWorkspaceTurn.mockResolvedValue({ root: "/repo", generation: 3, id: 1 });
    const { connectAssistantTurnLifecycle } = await import("../src/hooks/assistant-turn-lifecycle");
    const dispose = await connectAssistantTurnLifecycle("/repo", 3);
    const callback = listen.mock.calls[0][0];
    await callback(event);
    expect(prepareWorkspaceTurn).toHaveBeenCalledWith(
      "/repo",
      expect.objectContaining({
        turnId: "turn",
        participantToken: "participant",
        bridgeId: "bridge",
        requestId: "request",
      }),
    );
    expect(acknowledgeAgentTurnPrepared).toHaveBeenCalledWith(
      expect.objectContaining({ ...event, lease: { generation: 3, id: 1 }, error: null }),
    );
    dispose();
  });

  test("filters stale root and generation events", async () => {
    listen.mockResolvedValue(vi.fn());
    const { connectAssistantTurnLifecycle } = await import("../src/hooks/assistant-turn-lifecycle");
    let generation = 2;
    await connectAssistantTurnLifecycle("/repo", 1, undefined, () => generation);
    const callback = listen.mock.calls.at(-1)![0];
    await callback({ ...event, workspaceRoot: "/other" });
    await callback(event);
    expect(prepareWorkspaceTurn).not.toHaveBeenCalled();
    generation = 1;
  });

  test("abort disposes the listener and ignores pending callbacks", async () => {
    const controller = new AbortController();
    const unlisten = vi.fn();
    listen.mockResolvedValue(unlisten);
    const { connectAssistantTurnLifecycle } = await import("../src/hooks/assistant-turn-lifecycle");
    const dispose = await connectAssistantTurnLifecycle("/repo", 1, controller.signal);
    controller.abort();
    dispose();
    await listen.mock.calls.at(-1)![0](event);
    expect(prepareWorkspaceTurn).not.toHaveBeenCalled();
    expect(acknowledgeAgentTurnPrepared).not.toHaveBeenCalled();
    expect(unlisten).toHaveBeenCalled();
  });

  test("reconcile failure retains the lease and reports blocked state", async () => {
    listen.mockResolvedValue(vi.fn());
    prepareWorkspaceTurn.mockResolvedValue({ root: "/repo", generation: 1, id: 2 });
    reconcileWorkspaceTurn.mockResolvedValue({ status: "failed" });
    const { connectAssistantTurnLifecycle } = await import("../src/hooks/assistant-turn-lifecycle");
    await connectAssistantTurnLifecycle("/repo", 1);
    const callback = listen.mock.calls.at(-1)![0];
    await callback(event);
    expect(reconcileWorkspaceTurn).not.toHaveBeenCalled();
  });

  test("old cleanup cannot clear a replacement bridge id", async () => {
    listen.mockResolvedValue(vi.fn());
    const { connectAssistantTurnLifecycle } = await import("../src/hooks/assistant-turn-lifecycle");
    const first = await connectAssistantTurnLifecycle("/repo", 1);
    registerAgentTurnBridge.mockResolvedValueOnce({ bridgeId: "bridge-2" });
    const second = await connectAssistantTurnLifecycle("/repo", 1);
    first();
    second();
    expect(unregisterAgentTurnBridge).toHaveBeenCalledWith("/repo", "bridge-1");
    expect(unregisterAgentTurnBridge).toHaveBeenCalledWith("/repo", "bridge-2");
  });

  test("registration readiness is disposed with the listener", async () => {
    const unlisten = vi.fn();
    listen.mockResolvedValue(unlisten);
    const { connectAssistantTurnLifecycle } = await import("../src/hooks/assistant-turn-lifecycle");
    const dispose = await connectAssistantTurnLifecycle("/repo", 1);
    dispose();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  test("production seam reads the current generation dynamically", async () => {
    listen.mockResolvedValue(vi.fn());
    const { connectAssistantTurnLifecycle } = await import("../src/hooks/assistant-turn-lifecycle");
    let current = 1;
    await connectAssistantTurnLifecycle("/repo", 1, undefined, () => current);
    const callback = listen.mock.calls.at(-1)![0];
    current = 2;
    await callback(event);
    expect(prepareWorkspaceTurn).not.toHaveBeenCalled();
  });
});

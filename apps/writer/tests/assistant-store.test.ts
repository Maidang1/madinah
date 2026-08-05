import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("../src/platform/tauri/assistant", () => ({
  discoverAgentRuntimes: vi.fn(),
  cancelAgentDiscovery: vi.fn(),
  addAgentRegistration: vi.fn(),
  removeAgentRegistration: vi.fn(),
}));

import * as assistantApi from "../src/platform/tauri/assistant";
import type { AgentDiscoveryResponse } from "../src/platform/tauri/assistant";
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
});

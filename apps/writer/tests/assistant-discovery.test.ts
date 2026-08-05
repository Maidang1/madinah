import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
  addAgentRegistration,
  cancelAgentDiscovery,
  discoverAgentRuntimes,
  removeAgentRegistration,
} from "../src/platform/tauri/assistant";

const mockedInvoke = vi.mocked(invoke);

describe("Assistant discovery desktop boundary", () => {
  beforeEach(() => mockedInvoke.mockReset());

  test("uses one typed command surface for discovery and custom registrations", async () => {
    mockedInvoke.mockResolvedValue({ revision: 1, registrations: [] });

    await discoverAgentRuntimes("/workspace");
    await cancelAgentDiscovery();
    await addAgentRegistration("/workspace", "/usr/local/bin/my-acp", ["--stdio"]);
    await removeAgentRegistration("/workspace", "custom-id");

    expect(mockedInvoke.mock.calls).toEqual([
      ["discover_agent_runtimes", { workspaceRoot: "/workspace" }],
      ["cancel_agent_discovery"],
      [
        "add_agent_registration",
        { workspaceRoot: "/workspace", command: "/usr/local/bin/my-acp", args: ["--stdio"] },
      ],
      ["remove_agent_registration", { workspaceRoot: "/workspace", id: "custom-id" }],
    ]);
  });
});

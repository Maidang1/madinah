import { describe, expect, test, vi } from "vite-plus/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantCatalogView } from "../src/components/assistant/assistant-panel";
import type { AgentDiscovery } from "../src/platform/tauri/assistant";

function agent(overrides: Partial<AgentDiscovery>): AgentDiscovery {
  return {
    id: "agent",
    name: "Agent",
    source: "built-in",
    command: "agent-acp",
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
    message: "ACP initialization succeeded.",
    missingCapabilities: [],
    agentInfo: null,
    authMethods: [],
    ...overrides,
  };
}

describe("Assistant discovery shell", () => {
  test("renders actionable compatibility states without conversation controls", () => {
    const markup = renderToStaticMarkup(
      createElement(AssistantCatalogView, {
        phase: "ready",
        error: null,
        registrationError: null,
        agents: [
          agent({ id: "ready", name: "Ready Agent" }),
          agent({ id: "missing", name: "Missing Agent", status: "missing" }),
          agent({
            id: "auth",
            name: "Auth Agent",
            status: "authentication-required",
            message: "Sign in from the Agent CLI.",
          }),
          agent({
            id: "incompatible",
            name: "Old Agent",
            status: "incompatible",
            missingCapabilities: ["session-restore"],
          }),
        ],
        onRefresh: vi.fn(),
        onAdd: vi.fn(),
        onRemove: vi.fn(),
      }),
    );

    expect(markup).toContain("Ready Agent");
    expect(markup).toContain("Compatible");
    expect(markup).toContain("Install Agent");
    expect(markup).toContain("Authentication required");
    expect(markup).toContain("session-restore");
    expect(markup).toContain("Add custom Agent");
    expect(markup).toContain("canonical absolute path");
    expect(markup).toContain("native executable");
    expect(markup).toContain("Configure and authenticate it outside Writer");
    expect(markup).toContain("self-contained");
    expect(markup).toContain("current_exe");
    expect(markup).toContain("$ORIGIN");
    expect(markup).toContain("@executable_path");
    expect(markup).toContain("--stdio");
    expect(markup).not.toContain("Put one argument on each line");
    expect(markup).not.toContain("Send message");
  });
});

import { describe, expect, test, vi } from "vite-plus/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AssistantCatalogView,
  AssistantTurnView,
} from "../src/components/assistant/assistant-panel";
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

  test("shows complete per-Workspace consent and an executable one-shot permission request", () => {
    const viewProps = {
      agents: [agent({ id: "ready", name: "Ready Agent" })],
      selectedAgentId: null as string | null,
      turnBridgeReady: true,
      conversation: null,
      conversations: [],
      onGrantConsent: vi.fn(),
      onSelectAgent: vi.fn(),
      onCreateConversation: vi.fn(),
      onSelectConversation: vi.fn(),
      onRenameConversation: vi.fn(),
      onDeleteConversation: vi.fn(),
      onSend: vi.fn(),
      onRespondPermission: vi.fn(),
    };
    const consent = renderToStaticMarkup(
      createElement(AssistantTurnView, { ...viewProps, consent: "required" }),
    );
    expect(consent).toContain("may use cloud services");
    expect(consent).toContain("unrestricted read and write access");
    expect(consent).toContain("ignored files");
    expect(consent).toContain("not open as Documents");
    expect(consent).toContain("does not provide rollback");
    expect(consent).toContain("Enable for this Workspace");

    const permission = renderToStaticMarkup(
      createElement(AssistantTurnView, {
        ...viewProps,
        consent: "granted",
        selectedAgentId: "ready",
        conversations: [
          {
            id: "conversation-1",
            workspaceRoot: "/workspace",
            agentId: "ready",
            name: "Draft",
            createdAt: 1,
            updatedAt: 1,
            restoreStatus: "active",
          },
        ],
        conversation: {
          id: "conversation-1",
          name: "Draft",
          agentId: "ready",
          restoreStatus: "active",
          runtimeSessionId: "session-1",
          messages: [],
          turns: [],
          turnId: "turn-1",
          prompt: "Do work",
          output: "",
          changeSummaries: [],
          status: "awaiting-permission",
          message: null,
          reconciliation: null,
          permission: {
            requestId: "permission-1",
            title: "Access the network",
            options: [
              { id: "allow-once", name: "Allow once", kind: "allow-once" },
              { id: "reject-once", name: "Reject", kind: "reject-once" },
            ],
            responding: false,
          },
        },
      }),
    );
    expect(permission).toContain("External Action");
    expect(permission).toContain("Access the network");
    expect(permission).toContain("Allow once");
    expect(permission).toContain("Reject");
    expect(permission).toContain("Selected Conversation is bound to");
    expect(permission).toContain("Delete");
  });
});

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// Frontend mirror only. Rust serde models own this wire contract; see
// docs/assistant-discovery-contract.md and the serialized Tauri boundary tests.

export type AgentSource = "built-in" | "custom";
export type CapabilitySupport = "protocol-baseline" | "advertised";
export type AgentStatus =
  | "compatible"
  | "missing"
  | "authentication-required"
  | "incompatible"
  | "handshake-failed";

export interface AgentCapabilities {
  streamedText: CapabilitySupport;
  sessionCreate: CapabilitySupport;
  sessionRestore: CapabilitySupport;
  cancellation: CapabilitySupport;
  workspaceCwd: CapabilitySupport;
  permissionRequests: CapabilitySupport;
}

export interface AgentInfo {
  name: string;
  version: string;
}

export interface AuthMethodInfo {
  id: string;
  name: string;
  description: string | null;
}

export interface AgentDiscovery {
  id: string;
  name: string;
  source: AgentSource;
  command: string;
  args: string[];
  setupUrl: string;
  capabilities: AgentCapabilities;
  status: AgentStatus;
  message: string;
  missingCapabilities: string[];
  agentInfo: AgentInfo | null;
  authMethods: AuthMethodInfo[];
}

export interface AgentDiscoveryResponse {
  workspaceRoot: string;
  registrationRevision: number;
  registrationError: string | null;
  agents: AgentDiscovery[];
}

export interface CustomAgentRegistration {
  id: string;
  command: string;
  args: string[];
}

export interface AgentRegistrationSnapshot {
  version: number;
  revision: number;
  registrations: CustomAgentRegistration[];
}

export interface AiAccessConsent {
  granted: boolean;
  workspaceRoot: string;
  revision: number;
}

export interface TurnBridgeRegistration {
  bridgeId: string;
  workspaceRoot: string;
  workspaceEpoch: number;
  frontendGeneration: number;
}

export interface FrontendLeaseIdentity {
  generation: number;
  id: number;
}

interface TurnLifecycleIdentity {
  turnId: string;
  conversationId: string;
  workspaceRoot: string;
  workspaceEpoch: number;
  participantToken: string;
  bridgeId: string;
  requestId: string;
}

export type AgentTurnPhase = "preparing" | "running" | "awaiting-permission" | "reconciling";

export type AgentTurnEvent =
  | ({ type: "prepare" } & TurnLifecycleIdentity)
  | ({ type: "reconcile"; lease: FrontendLeaseIdentity } & TurnLifecycleIdentity)
  | {
      type: "phase";
      turnId: string;
      conversationId: string;
      workspaceRoot: string;
      phase: AgentTurnPhase;
    }
  | {
      type: "stream-text";
      turnId: string;
      conversationId: string;
      workspaceRoot: string;
      text: string;
    }
  | {
      type: "change-summary";
      turnId: string;
      conversationId: string;
      workspaceRoot: string;
      summary: string;
    }
  | {
      type: "permission";
      turnId: string;
      conversationId: string;
      workspaceRoot: string;
      requestId: string;
      title: string;
      options: Array<{ id: string; name: string; kind: string }>;
    }
  | {
      type: "reconciliation-blocked";
      turnId: string;
      conversationId: string;
      workspaceRoot: string;
      message: string;
    }
  | {
      type: "terminal";
      turnId: string;
      conversationId: string;
      workspaceRoot: string;
      status: "completed" | "failed";
      message: string;
    };

export interface StartAgentTurnResponse {
  turnId: string;
  conversationId: string;
  workspaceRoot: string;
}

export function discoverAgentRuntimes(workspaceRoot: string): Promise<AgentDiscoveryResponse> {
  return invoke("discover_agent_runtimes", { workspaceRoot });
}

export function cancelAgentDiscovery(): Promise<number> {
  return invoke("cancel_agent_discovery");
}

export function addAgentRegistration(
  workspaceRoot: string,
  command: string,
  args: string[],
): Promise<AgentRegistrationSnapshot> {
  return invoke("add_agent_registration", { workspaceRoot, command, args });
}

export function removeAgentRegistration(
  workspaceRoot: string,
  id: string,
): Promise<AgentRegistrationSnapshot> {
  return invoke("remove_agent_registration", { workspaceRoot, id });
}

export function getAiAccessConsent(workspaceRoot: string): Promise<AiAccessConsent> {
  return invoke("get_ai_access_consent", { workspaceRoot });
}

export function grantAiAccessConsent(workspaceRoot: string): Promise<AiAccessConsent> {
  return invoke("grant_ai_access_consent", { workspaceRoot });
}

export function registerAgentTurnBridge(
  workspaceRoot: string,
  frontendGeneration: number,
  expectedBridgeId?: string,
): Promise<TurnBridgeRegistration> {
  return invoke("register_agent_turn_bridge", {
    workspaceRoot,
    frontendGeneration,
    expectedBridgeId: expectedBridgeId ?? null,
  });
}

export function unregisterAgentTurnBridge(
  workspaceRoot: string,
  bridgeId: string,
): Promise<boolean> {
  return invoke("unregister_agent_turn_bridge", { workspaceRoot, bridgeId });
}

export function startAgentTurn(
  workspaceRoot: string,
  agentId: string,
  registrationRevision: number,
  conversationId: string,
  prompt: string,
): Promise<StartAgentTurnResponse> {
  return invoke("start_agent_turn", {
    workspaceRoot,
    agentId,
    registrationRevision,
    conversationId,
    prompt,
  });
}

export function acknowledgeAgentTurnPrepared(
  acknowledgement: TurnLifecycleIdentity & {
    lease: FrontendLeaseIdentity | null;
    error: string | null;
  },
): Promise<"ready" | "failed" | "pending"> {
  return invoke("acknowledge_agent_turn_prepared", { acknowledgement });
}

export function acknowledgeAgentTurnReconciled(
  acknowledgement: TurnLifecycleIdentity & {
    lease: FrontendLeaseIdentity;
    result: "completed" | "failed";
  },
): Promise<boolean> {
  return invoke("acknowledge_agent_turn_reconciled", { acknowledgement });
}

export function respondAgentTurnPermission(
  workspaceRoot: string,
  turnId: string,
  requestId: string,
  optionId: string | null,
): Promise<void> {
  return invoke("respond_agent_turn_permission", {
    workspaceRoot,
    turnId,
    requestId,
    optionId,
  });
}

export function listenAgentTurnEvents(
  handler: (event: AgentTurnEvent) => void,
): Promise<UnlistenFn> {
  return listen<AgentTurnEvent>("assistant:turn-event", (event) => handler(event.payload));
}

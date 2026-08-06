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
export type ConversationRestoreStatus = "none" | "active" | "failed";

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
      restoreStatus: ConversationRestoreStatus;
      persistenceError: string | null;
    };

export interface StartAgentTurnResponse {
  turnId: string;
  conversationId: string;
  workspaceRoot: string;
}

export type ConversationMessageRole = "user" | "assistant";

export interface ConversationCitation {
  path: string;
  heading: string | null;
}

export interface ConversationMessage {
  id: string;
  role: ConversationMessageRole;
  content: string;
  citations: ConversationCitation[];
  createdAt: number;
}

export interface ConversationPermissionDecision {
  requestId: string;
  title: string;
  optionId: string | null;
  decidedAt: number;
}

export interface ConversationTurn {
  turnId: string;
  status: string;
  outcomeMessage: string;
  changeSummaries: string[];
  permissionDecisions: ConversationPermissionDecision[];
  startedAt: number;
  finishedAt: number;
}

export interface ConversationSummary {
  id: string;
  workspaceRoot: string;
  agentId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  restoreStatus: ConversationRestoreStatus;
}

export interface ConversationRecord {
  version: number;
  id: string;
  workspaceRoot: string;
  agentId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  runtimeSessionId: string | null;
  restoreStatus: ConversationRestoreStatus;
  messages: ConversationMessage[];
  turns: ConversationTurn[];
}

export interface WorkspaceConversationSnapshot {
  workspaceRoot: string;
  revision: number;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  lastAgentId: string | null;
  activeConversation: ConversationRecord | null;
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

export function listAssistantConversations(
  workspaceRoot: string,
): Promise<WorkspaceConversationSnapshot> {
  return invoke("list_assistant_conversations", { workspaceRoot });
}

export interface ConversationWriteResult {
  revision: number;
  conversation: ConversationRecord;
}

export function createAssistantConversation(
  workspaceRoot: string,
  agentId: string,
  name?: string | null,
): Promise<ConversationWriteResult> {
  return invoke("create_assistant_conversation", {
    workspaceRoot,
    agentId,
    name: name ?? null,
  });
}

export function renameAssistantConversation(
  workspaceRoot: string,
  conversationId: string,
  name: string,
): Promise<ConversationWriteResult> {
  return invoke("rename_assistant_conversation", {
    workspaceRoot,
    conversationId,
    name,
  });
}

export function selectAssistantConversation(
  workspaceRoot: string,
  conversationId: string,
): Promise<ConversationWriteResult> {
  return invoke("select_assistant_conversation", {
    workspaceRoot,
    conversationId,
  });
}

export function deleteAssistantConversation(
  workspaceRoot: string,
  conversationId: string,
): Promise<WorkspaceConversationSnapshot> {
  return invoke("delete_assistant_conversation", {
    workspaceRoot,
    conversationId,
  });
}

export function rememberAssistantAgent(workspaceRoot: string, agentId: string): Promise<void> {
  return invoke("remember_assistant_agent", { workspaceRoot, agentId });
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

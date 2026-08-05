import { invoke } from "@tauri-apps/api/core";

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

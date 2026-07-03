export type AcpAgentProvider = "codex" | "claude";

export interface AcpEnvVar {
  name: string;
  value: string;
}

export interface AcpAgentRuntimeConfig {
  provider: AcpAgentProvider;
  command: string;
  env: AcpEnvVar[];
  instruction: string;
  timeoutSeconds: number;
}

export interface AcpPolishInput extends AcpAgentRuntimeConfig {
  content: string;
  workspaceRoot?: string | null;
}

export interface AcpPolishResult {
  content: string;
  provider: AcpAgentProvider;
}

export interface AcpAgentCheckResult {
  ok: boolean;
  agentName?: string | null;
  message: string;
}

import type {
  AcpAgentProvider,
  AcpAgentRuntimeConfig,
  AcpEnvVar,
} from "../../domain/ai-polish";

export interface AcpAgentSettings {
  command: string;
  env: AcpEnvVar[];
  instruction: string;
  timeoutSeconds: number;
}

export interface AcpSettings {
  provider: AcpAgentProvider;
  agents: Record<AcpAgentProvider, AcpAgentSettings>;
}

export interface EnvParseResult {
  env: AcpEnvVar[];
  errors: string[];
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const ACP_SETTINGS_STORAGE_KEY = "madinah-writer-acp-settings-v1";

export const DEFAULT_POLISH_INSTRUCTION =
  "Polish the Markdown body for clarity, fluency, and natural expression. Preserve the original meaning, facts, Markdown structure, links, code fences, and MDX/JSX components. Return only the polished Markdown body.";

const DEFAULT_TIMEOUT_SECONDS = 120;

const DEFAULT_AGENT_SETTINGS: Record<AcpAgentProvider, AcpAgentSettings> = {
  codex: {
    command: "npx -y @agentclientprotocol/codex-acp",
    env: [],
    instruction: DEFAULT_POLISH_INSTRUCTION,
    timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
  },
  claude: {
    command: "npx -y @agentclientprotocol/claude-agent-acp",
    env: [],
    instruction: DEFAULT_POLISH_INSTRUCTION,
    timeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
  },
};

export const ACP_PROVIDER_LABEL: Record<AcpAgentProvider, string> = {
  codex: "Codex",
  claude: "Claude Code",
};

export function createDefaultAcpSettings(): AcpSettings {
  return {
    provider: "codex",
    agents: {
      codex: cloneAgentSettings(DEFAULT_AGENT_SETTINGS.codex),
      claude: cloneAgentSettings(DEFAULT_AGENT_SETTINGS.claude),
    },
  };
}

export function loadAcpSettings(
  storage: StorageLike | null = getDefaultStorage(),
): AcpSettings {
  if (!storage) return createDefaultAcpSettings();

  const raw = storage.getItem(ACP_SETTINGS_STORAGE_KEY);
  if (!raw) return createDefaultAcpSettings();

  try {
    return normalizeAcpSettings(JSON.parse(raw));
  } catch {
    return createDefaultAcpSettings();
  }
}

export function saveAcpSettings(
  settings: AcpSettings,
  storage: StorageLike | null = getDefaultStorage(),
) {
  if (!storage) return;
  storage.setItem(ACP_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeAcpSettings(settings)));
}

export function getSelectedAcpRuntimeConfig(
  settings: AcpSettings,
): AcpAgentRuntimeConfig {
  const normalized = normalizeAcpSettings(settings);
  const agent = normalized.agents[normalized.provider];

  return {
    provider: normalized.provider,
    command: agent.command,
    env: agent.env,
    instruction: agent.instruction,
    timeoutSeconds: agent.timeoutSeconds,
  };
}

export function normalizeAcpSettings(value: unknown): AcpSettings {
  const fallback = createDefaultAcpSettings();
  if (!isRecord(value)) return fallback;

  const provider = toProvider(value.provider) ?? fallback.provider;
  const agentsValue = isRecord(value.agents) ? value.agents : {};

  return {
    provider,
    agents: {
      codex: normalizeAgentSettings(agentsValue.codex, fallback.agents.codex),
      claude: normalizeAgentSettings(agentsValue.claude, fallback.agents.claude),
    },
  };
}

export function parseEnvText(value: string): EnvParseResult {
  const env: AcpEnvVar[] = [];
  const errors: string[] = [];

  value.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      errors.push(`Line ${index + 1} needs KEY=value`);
      return;
    }

    const name = trimmed.slice(0, separatorIndex).trim();
    const envValue = trimmed.slice(separatorIndex + 1);
    if (!isValidEnvName(name)) {
      errors.push(`Line ${index + 1} has an invalid key`);
      return;
    }

    env.push({ name, value: envValue });
  });

  return { env, errors };
}

export function formatEnvText(env: AcpEnvVar[]): string {
  return env.map((item) => `${item.name}=${item.value}`).join("\n");
}

function normalizeAgentSettings(
  value: unknown,
  fallback: AcpAgentSettings,
): AcpAgentSettings {
  if (!isRecord(value)) return cloneAgentSettings(fallback);

  const command = typeof value.command === "string" && value.command.trim()
    ? value.command.trim()
    : fallback.command;
  const instruction =
    typeof value.instruction === "string" && value.instruction.trim()
      ? value.instruction.trim()
      : fallback.instruction;
  const timeoutSeconds = normalizeTimeout(value.timeoutSeconds, fallback.timeoutSeconds);

  return {
    command,
    env: normalizeEnv(value.env),
    instruction,
    timeoutSeconds,
  };
}

function normalizeEnv(value: unknown): AcpEnvVar[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.name !== "string") return [];
    const name = item.name.trim();
    if (!isValidEnvName(name)) return [];
    return [
      {
        name,
        value: typeof item.value === "string" ? item.value : String(item.value ?? ""),
      },
    ];
  });
}

function normalizeTimeout(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(10, Math.min(600, Math.round(numeric)));
}

function toProvider(value: unknown): AcpAgentProvider | null {
  return value === "codex" || value === "claude" ? value : null;
}

function isValidEnvName(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function cloneAgentSettings(settings: AcpAgentSettings): AcpAgentSettings {
  return {
    ...settings,
    env: settings.env.map((item) => ({ ...item })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getDefaultStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

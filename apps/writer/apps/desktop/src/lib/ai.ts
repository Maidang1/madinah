import type { AiEnvVar, AiSettings } from "./tauri";

export const DEFAULT_POLISH_INSTRUCTION =
  "Polish the Markdown body for clarity, fluency, and natural expression. Preserve the original meaning, facts, Markdown structure, links, code fences, and MDX/JSX components. Return only the polished Markdown body.";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  schemaVersion: 1,
  provider: "codex",
  agents: {
    codex: {
      command: "npx -y @agentclientprotocol/codex-acp",
      env: [],
      instruction: DEFAULT_POLISH_INSTRUCTION,
      timeoutSeconds: 120,
    },
    claude: {
      command: "npx -y @agentclientprotocol/claude-agent-acp",
      env: [],
      instruction: DEFAULT_POLISH_INSTRUCTION,
      timeoutSeconds: 120,
    },
  },
};

export interface EnvParseResult {
  env: AiEnvVar[];
  errors: string[];
}

export function parseEnvText(value: string): EnvParseResult {
  const env: AiEnvVar[] = [];
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

export function formatEnvText(env: AiEnvVar[]): string {
  return env.map((item) => `${item.name}=${item.value}`).join("\n");
}

export function normalizeTimeoutSeconds(value: string | number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_AI_SETTINGS.agents.codex.timeoutSeconds;
  return Math.max(10, Math.min(600, Math.round(numeric)));
}

function isValidEnvName(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

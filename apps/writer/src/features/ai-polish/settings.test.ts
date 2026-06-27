import { describe, expect, it } from "vitest";
import {
  ACP_SETTINGS_STORAGE_KEY,
  createDefaultAcpSettings,
  formatEnvText,
  getSelectedAcpRuntimeConfig,
  loadAcpSettings,
  normalizeAcpSettings,
  parseEnvText,
  saveAcpSettings,
} from "./settings";

describe("ACP settings", () => {
  it("uses Codex as the default local ACP agent", () => {
    const settings = createDefaultAcpSettings();
    const runtime = getSelectedAcpRuntimeConfig(settings);

    expect(runtime.provider).toBe("codex");
    expect(runtime.command).toBe("npx -y @agentclientprotocol/codex-acp");
    expect(runtime.timeoutSeconds).toBe(120);
  });

  it("persists normalized settings to storage", () => {
    const storage = createMemoryStorage();
    const settings = createDefaultAcpSettings();
    settings.provider = "claude";
    settings.agents.claude.env = [{ name: "ANTHROPIC_BASE_URL", value: "http://localhost" }];

    saveAcpSettings(settings, storage);
    const loaded = loadAcpSettings(storage);

    expect(storage.getItem(ACP_SETTINGS_STORAGE_KEY)).toContain("claude");
    expect(loaded.provider).toBe("claude");
    expect(loaded.agents.claude.env).toEqual([
      { name: "ANTHROPIC_BASE_URL", value: "http://localhost" },
    ]);
  });

  it("parses KEY=value environment lines", () => {
    const parsed = parseEnvText("CODEX_PATH=/usr/local/bin/codex\nOPENAI_API_KEY=sk-test");

    expect(parsed.errors).toEqual([]);
    expect(parsed.env).toEqual([
      { name: "CODEX_PATH", value: "/usr/local/bin/codex" },
      { name: "OPENAI_API_KEY", value: "sk-test" },
    ]);
    expect(formatEnvText(parsed.env)).toBe(
      "CODEX_PATH=/usr/local/bin/codex\nOPENAI_API_KEY=sk-test",
    );
  });

  it("reports invalid environment lines", () => {
    const parsed = parseEnvText("1_BAD=value\nMISSING");

    expect(parsed.env).toEqual([]);
    expect(parsed.errors).toEqual([
      "Line 1 has an invalid key",
      "Line 2 needs KEY=value",
    ]);
  });

  it("normalizes corrupted stored settings", () => {
    const settings = normalizeAcpSettings({
      provider: "gemini",
      agents: {
        codex: {
          command: "",
          env: [{ name: "BAD-NAME", value: "x" }],
          instruction: "",
          timeoutSeconds: 9999,
        },
      },
    });

    expect(settings.provider).toBe("codex");
    expect(settings.agents.codex.command).toBe(
      "npx -y @agentclientprotocol/codex-acp",
    );
    expect(settings.agents.codex.env).toEqual([]);
    expect(settings.agents.codex.timeoutSeconds).toBe(600);
  });
});

function createMemoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

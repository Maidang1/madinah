import type { AiSettings } from "./tauri";

export const DEFAULT_POLISH_INSTRUCTION =
  "Polish the Markdown body for clarity, fluency, and natural expression. Preserve the original meaning, facts, Markdown structure, links, code fences, and MDX/JSX components. Return only the polished Markdown body.";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  schemaVersion: 2,
  codexPath: "",
  model: "",
  instruction: DEFAULT_POLISH_INSTRUCTION,
  timeoutSeconds: 120,
};

export function normalizeTimeoutSeconds(value: string | number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_AI_SETTINGS.timeoutSeconds;
  return Math.max(10, Math.min(600, Math.round(numeric)));
}

import { describe, expect, test } from "vite-plus/test";
import { DEFAULT_AI_SETTINGS, normalizeTimeoutSeconds } from "../src/lib/ai";
import { AI_ACTION_KINDS } from "../src/platform/tauri/ai";

describe("AI settings helpers", () => {
  test("uses Codex SDK settings", () => {
    expect(DEFAULT_AI_SETTINGS).toEqual({
      schemaVersion: 2,
      codexPath: "",
      model: "",
      instruction: expect.any(String),
      timeoutSeconds: 120,
    });
  });

  test("normalizes timeout bounds", () => {
    expect(normalizeTimeoutSeconds("1")).toBe(10);
    expect(normalizeTimeoutSeconds("120")).toBe(120);
    expect(normalizeTimeoutSeconds("999")).toBe(600);
  });

  test("exposes every editor AI action kind", () => {
    expect(AI_ACTION_KINDS).toEqual([
      "polish-document",
      "rewrite-selection",
      "shorten-selection",
      "expand-selection",
      "translate-selection",
      "continue-writing",
      "generate-outline",
      "generate-metadata",
      "review-document",
    ]);
  });
});

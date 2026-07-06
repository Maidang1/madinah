import { describe, expect, test } from "vite-plus/test";
import { formatEnvText, normalizeTimeoutSeconds, parseEnvText } from "../src/lib/ai";

describe("AI settings helpers", () => {
  test("parses KEY=value environment lines", () => {
    expect(parseEnvText("OPENAI_API_KEY=secret\nANTHROPIC_API_KEY=abc=123")).toEqual({
      env: [
        { name: "OPENAI_API_KEY", value: "secret" },
        { name: "ANTHROPIC_API_KEY", value: "abc=123" },
      ],
      errors: [],
    });
  });

  test("reports invalid environment lines", () => {
    expect(parseEnvText("BAD_LINE\n1_BAD=value").errors).toEqual([
      "Line 1 needs KEY=value",
      "Line 2 has an invalid key",
    ]);
  });

  test("formats environment lines", () => {
    expect(
      formatEnvText([
        { name: "A", value: "1" },
        { name: "B", value: "2" },
      ]),
    ).toBe("A=1\nB=2");
  });

  test("normalizes timeout bounds", () => {
    expect(normalizeTimeoutSeconds("1")).toBe(10);
    expect(normalizeTimeoutSeconds("120")).toBe(120);
    expect(normalizeTimeoutSeconds("999")).toBe(600);
  });
});

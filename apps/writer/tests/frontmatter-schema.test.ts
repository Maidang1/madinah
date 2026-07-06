import { describe, expect, test } from "vite-plus/test";
import {
  FRONTMATTER_STATUS_OPTIONS,
  formatFrontmatterControlValue,
  getFrontmatterFieldDefinition,
  getSelectOptionsWithCurrentValue,
  parseFrontmatterControlValue,
} from "../src/lib/frontmatter-schema";
import type { YamlEntry } from "../src/lib/yaml-entries";

const entry = (key: string, value: string, isComplex = false): YamlEntry => ({
  id: "test",
  key,
  value,
  isComplex,
});

describe("frontmatter field schema", () => {
  test("maps status to a select enum", () => {
    const definition = getFrontmatterFieldDefinition("status");

    expect(definition.control.kind).toBe("select");
    if (definition.control.kind === "select") {
      expect(definition.control.options).toEqual(FRONTMATTER_STATUS_OPTIONS);
      expect(definition.control.options).toContain("published");
    }
  });

  test("keeps unknown fields editable as text", () => {
    expect(getFrontmatterFieldDefinition("custom").control.kind).toBe("text");
  });

  test("formats and parses tags as a YAML list", () => {
    expect(formatFrontmatterControlValue(entry("tags", "- Agent\n- AI", true))).toBe("Agent, AI");

    const next = parseFrontmatterControlValue("tags", "Agent, AI");
    expect(next.isComplex).toBe(true);
    expect(next.value).toContain("- Agent");
    expect(next.value).toContain("- AI");
  });

  test("keeps empty tags as an empty YAML list", () => {
    expect(parseFrontmatterControlValue("tags", "").value).toBe("[]");
  });

  test("formats and parses pubDate through datetime-local", () => {
    expect(formatFrontmatterControlValue(entry("pubDate", "2026-07-01 17:04:32"))).toBe(
      "2026-07-01T17:04:32",
    );
    expect(parseFrontmatterControlValue("pubDate", "2026-07-01T17:04:32")).toEqual({
      value: "2026-07-01 17:04:32",
      isComplex: false,
    });
  });

  test("preserves unknown select values in the option list", () => {
    expect(getSelectOptionsWithCurrentValue(FRONTMATTER_STATUS_OPTIONS, "archived")).toEqual([
      "archived",
      "draft",
      "published",
    ]);
  });
});

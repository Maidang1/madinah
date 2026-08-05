import { describe, expect, test } from "vite-plus/test";
import { resolvePaneWidths } from "../src/lib/pane-layout";

describe("three-pane layout budget", () => {
  test("preserves the document minimum while both side panes are visible", () => {
    const result = resolvePaneWidths({
      containerWidth: 900,
      leftVisible: true,
      leftWidth: 420,
      rightVisible: true,
      rightWidth: 480,
    });

    expect(result.left + result.right).toBeLessThanOrEqual(540);
    expect(result.editor).toBeGreaterThanOrEqual(360);
  });

  test("a requested resize is clamped against the other visible pane", () => {
    const result = resolvePaneWidths({
      containerWidth: 1200,
      leftVisible: true,
      leftWidth: 900,
      rightVisible: true,
      rightWidth: 320,
      preferredPane: "left",
    });

    expect(result.right).toBe(320);
    expect(result.left).toBe(420);
    expect(result.editor).toBeGreaterThanOrEqual(360);
  });

  test("a narrow container still reserves the document before either side pane", () => {
    const result = resolvePaneWidths({
      containerWidth: 500,
      leftVisible: true,
      leftWidth: 300,
      rightVisible: true,
      rightWidth: 320,
      preferredPane: "left",
    });

    expect(result.left + result.right).toBeLessThanOrEqual(140);
    expect(result.editor).toBe(360);
  });
});

import { describe, expect, test } from "vite-plus/test";
import { getBackslashShortcut } from "../src/hooks/use-keyboard-shortcuts";

describe("physical Backslash shortcuts", () => {
  test("Cmd+Shift+Backslash reveals the Assistant when the shifted key value is a pipe", () => {
    expect(
      getBackslashShortcut({
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        code: "Backslash",
        key: "|",
      }),
    ).toBe("assistant");
  });

  test("Cmd+Backslash continues to target the sidebar", () => {
    expect(
      getBackslashShortcut({
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        code: "Backslash",
        key: "\\",
      }),
    ).toBe("sidebar");
  });
});

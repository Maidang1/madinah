import { describe, expect, test } from "vite-plus/test";
import { __testSyntaxHighlighting } from "../src/lib/prosemark-core/syntaxHighlighting";

describe("baseTheme", () => {
  test("inline code follows the Madinah reader code treatment", () => {
    const inlineCode = __testSyntaxHighlighting.baseThemeSpec[".cm-inline-code"];

    expect(inlineCode.fontSize).toBe("0.92em");
    expect(inlineCode.fontFamily).toContain("--reader-font");
    expect(inlineCode.borderRadius).toBe("4px");
  });
});

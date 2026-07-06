import { describe, expect, test } from "vite-plus/test";
import { __testCodeFenceExtension } from "../src/lib/prosemark-core/codeFenceExtension";

describe("codeFenceTheme", () => {
  test("fenced code lines use the code block font size variable", () => {
    const fencedCodeLine = __testCodeFenceExtension.codeFenceThemeSpec[".cm-fenced-code-line"];

    expect(fencedCodeLine.fontSize).toBe("var(--writer-code-block-font-size, 14px)");
    expect(fencedCodeLine.lineHeight).toBe("var(--writer-code-block-line-height, 1.75)");
    expect(fencedCodeLine.fontFamily).toContain("--pm-code-font");
  });
});

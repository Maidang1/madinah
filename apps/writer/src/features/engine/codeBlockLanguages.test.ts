import { describe, expect, it } from "vitest";
import {
  CODE_BLOCK_EDITOR_EXTENSIONS,
  CODE_BLOCK_LANGUAGES,
} from "./codeBlockLanguages";

describe("code block language registry", () => {
  it("exposes a stable canonical fence token as alias[0] for each language", () => {
    for (const language of CODE_BLOCK_LANGUAGES) {
      expect(language.alias?.[0], `${language.name} needs a canonical alias`).toBeTruthy();
    }
  });

  it("keeps the fence tokens used by existing insert templates", () => {
    const canonicalTokens = new Set(
      CODE_BLOCK_LANGUAGES.map((language) => language.alias?.[0]),
    );

    for (const token of [
      "typescript",
      "tsx",
      "javascript",
      "rust",
      "json",
      "bash",
      "markdown",
      "plaintext",
    ]) {
      expect(canonicalTokens.has(token), `missing fence token ${token}`).toBe(true);
    }
  });

  it("ships syntax support for the highlightable languages", () => {
    const withSupport = CODE_BLOCK_LANGUAGES.filter(
      (language) => language.support,
    ).map((language) => language.name);

    // Plain text and Bash intentionally have no CodeMirror grammar.
    expect(withSupport).toContain("TypeScript");
    expect(withSupport).toContain("Rust");
    expect(withSupport).toContain("Python");
    expect(withSupport).toContain("JSON");
  });

  it("provides editor extensions for the dark code surface and highlighting", () => {
    expect(CODE_BLOCK_EDITOR_EXTENSIONS.length).toBeGreaterThan(0);
  });

  it("does not reuse a canonical token across two languages", () => {
    const tokens = CODE_BLOCK_LANGUAGES.map((language) => language.alias?.[0]);
    expect(new Set(tokens).size).toBe(tokens.length);
  });
});

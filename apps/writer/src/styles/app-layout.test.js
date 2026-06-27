import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");

describe("macOS document window layout", () => {
  it("uses full-window editor layout instead of a centered webpage card", () => {
    expect(css).toMatch(/\.writer-simple-app\s*\{[^}]*overflow: hidden;/);
    expect(css).toMatch(/\.writer-simple-app\s*\{[^}]*padding: 0;/);
    expect(css).toMatch(
      /\.writer-simple-app\s*\{[^}]*--reader-page: var\(--writer-editor-bg\);/,
    );
    expect(css).toMatch(
      /\.writer-simple-app\s*\{[^}]*--reader-paper: var\(--writer-editor-bg\);/,
    );
    expect(css).toMatch(/\.writer-simple-canvas\s*\{[^}]*width: 100%;/);
    expect(css).toMatch(/\.writer-simple-canvas\s*\{[^}]*height: 100%;/);
    expect(css).toMatch(/\.writer-simple-canvas\s*\{[^}]*border: 0;/);
    expect(css).toMatch(/\.writer-simple-canvas\s*\{[^}]*border-radius: 0;/);
    expect(css).toMatch(
      /\.writer-simple-canvas \.live-mdx-content\s*\{[^}]*min-height: calc\(100dvh - var\(--writer-titlebar-height\)\);/,
    );
    expect(css).toMatch(/\.writer-window\s*\{[^}]*margin: 0;/);
    expect(css).toMatch(/\.writer-window\s*\{[^}]*box-shadow: none;/);
    expect(css).toMatch(/--writer-titlebar-height: 34px;/);
    expect(css).toMatch(/--writer-sidebar-width: 360px;/);
    expect(css).toMatch(/--writer-desktop-bg: rgb\(18, 18, 18\);/);
    expect(css).toMatch(/--writer-window-bg: rgb\(18, 18, 18\);/);
    expect(css).toMatch(/\.writer-titlebar\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.writer-titlebar-title\s*\{[^}]*grid-row: 1;/);
    expect(css).toMatch(/\.writer-titlebar-title\s*\{[^}]*font-size: 13px;/);
    expect(css).toMatch(/\.writer-titlebar-meta\s*\{[^}]*grid-row: 1;/);
    expect(css).toMatch(/\.writer-titlebar-meta\s*\{[^}]*font-size: 13px;/);
    expect(css).toMatch(/\.file-tree\s*\{/);
    expect(css).toMatch(/margin: 34px auto 0;/);
    expect(css).not.toMatch(/\.writer-toolbar-button/);
    expect(css).toMatch(/\.writer-theme-toggle\s*\{[^}]*min-width: 40px;/);
    expect(css).toMatch(/\.writer-theme-toggle\s*\{[^}]*font-size: 12px;/);
    expect(css).toMatch(/\.writer-theme-toggle:focus-visible\s*,/);
    expect(css).toMatch(/\.writer-sidebar-toggle\s*\{[^}]*width: 20px;/);
    expect(css).toMatch(/\.writer-sidebar-toggle:focus-visible\s*,/);
    expect(css).toMatch(
      /\.writer-simple-canvas \.live-mdx-content\s*\{[^}]*font-family: var\(--reader-font\);/,
    );
    expect(css).toMatch(
      /\.writer-simple-canvas \.live-mdx-content\s*\{[^}]*font-size: 16\.15px;/,
    );
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./app.css", import.meta.url), "utf8");

describe("macOS document window layout", () => {
  it("uses full-window editor layout instead of a centered webpage card", () => {
    expect(css).toMatch(/\.writer-simple-app\s*\{[^}]*overflow: hidden;/);
    expect(css).toMatch(/\.writer-simple-app\s*\{[^}]*padding: 0;/);
    expect(css).toMatch(/\.writer-simple-app\s*\{[^}]*--reader-page: rgb\(29, 30, 32\);/);
    expect(css).toMatch(/\.writer-simple-app\s*\{[^}]*--reader-paper: rgb\(46, 46, 51\);/);
    expect(css).toMatch(/\.writer-simple-app\s*\{[^}]*--reader-width: 760px;/);
    expect(css).toMatch(/\.writer-simple-app\s*\{[^}]*--reader-font: "TsangerJinKai02"/);
    expect(css).toMatch(/\.light \.writer-simple-app\s*\{[^}]*--reader-page: rgb\(250, 249, 245\);/);
    expect(css).toMatch(/\.light \.writer-simple-app\s*\{[^}]*--reader-paper: rgb\(250, 249, 245\);/);
    expect(css).toMatch(/\.light \.writer-simple-app\s*\{[^}]*--reader-ink: rgba\(36, 41, 47, 0\.9\);/);
    expect(css).toMatch(/\.writer-simple-canvas\s*\{[^}]*width: 100%;/);
    expect(css).toMatch(/\.writer-simple-canvas\s*\{[^}]*height: 100%;/);
    expect(css).toMatch(/\.writer-simple-canvas\s*\{[^}]*overflow: auto;/);
    expect(css).toMatch(/\.writer-simple-canvas\s*\{[^}]*border: 0;/);
    expect(css).toMatch(/\.writer-simple-canvas\s*\{[^}]*border-radius: 0;/);
    expect(css).not.toContain(".writer-simple-canvas::-webkit-scrollbar");
    expect(css).not.toMatch(/\.writer-simple-canvas\s*\{[^}]*scrollbar-color:/);
    expect(css).toMatch(
      /\.writer-simple-canvas \.live-mdx-content\s*\{[^}]*box-sizing: border-box;/,
    );
    expect(css).toMatch(
      /\.writer-simple-canvas \.live-mdx-content\s*\{[^}]*min-height: calc\(100dvh - var\(--writer-titlebar-height\) - 86px\);/,
    );
    expect(css).toMatch(/\.writer-window\s*\{[^}]*margin: 0;/);
    expect(css).toMatch(/\.writer-window\s*\{[^}]*box-shadow: none;/);
    expect(css).toMatch(/--writer-titlebar-height: 48px;/);
    expect(css).toMatch(/--writer-sidebar-width: 280px;/);
    expect(css).toMatch(/--writer-desktop-bg: rgb\(28, 28, 30\);/);
    expect(css).toMatch(/--writer-window-bg: rgb\(30, 30, 32\);/);
    expect(css).toMatch(/\.light\s*\{[^}]*--writer-desktop-bg: rgb\(245, 244, 237\);/);
    expect(css).toMatch(/\.light\s*\{[^}]*--writer-window-bg: rgb\(250, 249, 245\);/);
    expect(css).toMatch(/\.light\s*\{[^}]*--writer-titlebar-bg: rgb\(250, 249, 245\);/);
    expect(css).toMatch(/\.light\s*\{[^}]*--writer-sidebar-bg: rgb\(245, 244, 239\);/);
    expect(css).toMatch(/\.light\s*\{[^}]*--writer-sidebar-active: rgb\(232, 230, 222\);/);
    expect(css).toMatch(/\.light\s*\{[^}]*--writer-editor-bg: rgb\(250, 249, 245\);/);
    expect(css).toMatch(/\.writer-titlebar\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\);/);
    expect(css).toMatch(/\.writer-titlebar-leading\s*\{/);
    expect(css).toMatch(/\.writer-titlebar-title\s*\{[^}]*grid-row: 1;/);
    expect(css).toMatch(/\.writer-titlebar-title\s*\{[^}]*font-size: 13px;/);
    expect(css).toMatch(/\.writer-titlebar-meta\s*\{[^}]*grid-row: 1;/);
    expect(css).toMatch(/\.writer-titlebar-meta\s*\{[^}]*font-size: 13px;/);
    expect(css).toMatch(/\.writer-workbench\s*\{[^}]*overflow: hidden;/);
    expect(css).toMatch(/\.writer-workbench\s*\{[^}]*background: var\(--reader-page\);/);
    expect(css).toMatch(/\.file-tree\s*\{/);
    expect(css).toMatch(/\.file-tree\s*\{[^}]*overflow: hidden;/);
    expect(css).toMatch(/\.file-tree-list\s*\{[^}]*width: 100% !important;/);
    expect(css).toMatch(/\.file-tree-list\s*\{[^}]*overflow-y: auto !important;/);
    expect(css).not.toContain("::-webkit-scrollbar");
    expect(css).not.toMatch(/scrollbar-width:/);
    expect(css).not.toMatch(/scrollbar-color:/);
    expect(css).toMatch(/\.file-tree-list-row\s*\{[^}]*width: 100% !important;/);
    expect(css).toMatch(/\.file-tree-context-menu\s*\{[^}]*z-index: 2147483647;/);
    expect(css).toMatch(/\.file-tree-context-menu\s*\{[^}]*width: 260px;/);
    expect(css).toMatch(/\.file-tree-context-menu\s*\{[^}]*border-radius: 11px;/);
    expect(css).toMatch(/\.file-tree-context-menu\s*\{[^}]*backdrop-filter: saturate\(160%\) blur\(22px\);/);
    expect(css).toMatch(/\.file-tree-context-menu-separator\s*\{[^}]*margin: 5px 22px;/);
    expect(css).toMatch(/\.file-tree-context-menu button\s*\{[^}]*font-size: 13px;/);
    expect(css).toMatch(/\.file-tree-context-menu button\s*\{[^}]*text-overflow: ellipsis;/);
    expect(css).toMatch(/\.file-tree-context-menu button:hover,\n\.file-tree-context-menu button:focus-visible\s*\{[^}]*background: rgb\(250 249 245\);/);
    expect(css).toMatch(/margin: 86px auto 0;/);
    expect(css).toMatch(/\.writer-toolbar-button\s*\{[^}]*width: 30px;/);
    expect(css).toMatch(/\.writer-toolbar-button\s*\{[^}]*height: 30px;/);
    expect(css).toMatch(/\.writer-toolbar-button:focus-visible\s*,/);
    expect(css).toMatch(/\.writer-view-mode-control\s*\{/);
    expect(css).toMatch(/\.writer-view-mode-option\s*\{[^}]*min-width: 62px;/);
    expect(css).toMatch(/\.writer-view-mode-option\.is-active\s*\{/);
    expect(css).toMatch(
      /\.writer-simple-canvas \.live-mdx-content\s*\{[^}]*font-family: var\(--reader-font\);/,
    );
    expect(css).toMatch(
      /\.writer-simple-canvas \.live-mdx-content\s*\{[^}]*font-size: 16\.15px;/,
    );
    expect(css).toMatch(/\.writer-simple-canvas \.live-mdx-content\s*\{[^}]*letter-spacing: 0\.42px;/);
    expect(css).toMatch(/\.writer-simple-canvas \.live-mdx-content\s*\{[^}]*line-height: 1\.76;/);
    expect(css).toMatch(
      /\.live-mdx-shell\.is-empty-document \.live-mdx-content\s*\{[^}]*margin: 0 auto;/,
    );
    expect(css).toMatch(
      /\.live-mdx-shell\.is-empty-document \.live-mdx-content\s*\{[^}]*min-height: 100%;/,
    );
    expect(css).toMatch(
      /\.live-mdx-shell\.is-empty-document \.live-mdx-content\s*\{[^}]*border-radius: 0;/,
    );
    expect(css).toMatch(
      /\.live-mdx-shell\.is-empty-document \.live-mdx-content\s*\{[^}]*background: transparent;/,
    );
    expect(css).toMatch(/\.document-start-state\s*\{[^}]*place-items: center;/);
    expect(css).toMatch(/\.document-start-state\s*\{[^}]*text-align: center;/);
    expect(css).toMatch(/\.document-start-copy p\s*\{[^}]*font-size: 14px;/);
    expect(css).toMatch(/\.document-start-button\s*\{[^}]*display: inline-flex;/);
    expect(css).toMatch(/\.document-start-button\s*\{[^}]*gap: 8px;/);
    expect(css).toMatch(/\.document-editor-shell\s*\{[^}]*background: transparent;/);
    expect(css).toMatch(/\.document-editor-shell\s*\{[^}]*box-sizing: border-box;/);
    expect(css).toMatch(
      /\.document-editor-shell\s*\{[^}]*min-height: calc\(100dvh - var\(--writer-titlebar-height\) - 86px\);/,
    );
    expect(css).toMatch(/\.document-editor-shell\s*\{[^}]*overflow: visible;/);
    expect(css).toMatch(/\.live-mdx-shell\s*\{[^}]*overflow: visible;/);
    expect(css).toMatch(/\.writer-preview\s*\{[^}]*overflow: visible;/);
    expect(css).toMatch(/\.writer-preview \.post-shell\s*\{[^}]*box-sizing: border-box;/);
    expect(css).toMatch(
      /\.writer-preview \.post-shell\s*\{[^}]*min-height: calc\(100dvh - var\(--writer-titlebar-height\) - 86px\);/,
    );
    expect(css).toMatch(/\.document-title-input\s*\{[^}]*font-size: 31px;/);
    expect(css).toMatch(/\.document-title-input\s*\{[^}]*border: 0;/);
    expect(css).toMatch(/\.document-title-input::placeholder\s*\{/);
    expect(css).toMatch(
      /@media \(max-width: 680px\)\s*\{[\s\S]*?\.document-editor-shell\s*\{[^}]*width: 100%;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 680px\)\s*\{[\s\S]*?\.writer-preview \.post-shell\s*\{[^}]*width: 100%;/,
    );
    expect(css).toMatch(
      /@media \(max-width: 680px\)\s*\{[\s\S]*?\.document-title-input\s*\{[^}]*font-size: 28px;/,
    );
    expect(css).not.toContain("Start writing...");
    expect(css).not.toMatch(/\.live-mdx-content p:empty::before\s*\{[^}]*content:/);
    expect(css).toMatch(/\.file-tree-draft-row \.tree-copy\s*\{[^}]*display: flex;/);
    expect(css).toMatch(/\.file-tree-draft-row \.tree-copy\s*\{[^}]*align-items: baseline;/);
    expect(css).toMatch(/\.tree-row\.is-folder \.tree-copy\s*\{[^}]*display: flex;/);
    expect(css).toMatch(/\.tree-row\.is-folder \.tree-copy\s*\{[^}]*align-items: baseline;/);
    expect(css).toMatch(/\.file-tree-draft-row small\s*\{[^}]*white-space: nowrap;/);
    expect(css).toMatch(/\.inspector-tabs\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(/\.inspector-tab\s*\{[^}]*white-space: nowrap;/);
    expect(css).toMatch(/\.inspector-tab-panel\s*\{[^}]*min-width: 0;/);
    expect(css).toMatch(/\.inspector-stat-list\s*\{[^}]*grid-template-columns: 1fr;/);
    expect(css).toMatch(
      /\.inspector-stat-row\s*\{[^}]*grid-template-columns: max-content minmax\(0, 1fr\);/,
    );
    expect(css).toMatch(/\.inspector-stat-label\s*\{[^}]*white-space: nowrap;/);
    expect(css).toMatch(/\.inspector-stat-value\s*\{[^}]*font-variant-numeric: tabular-nums;/);
    expect(css).toMatch(/\.inspector-stat-value\s*\{[^}]*text-align: right;/);
    expect(css).toMatch(
      /@media \(min-width: 681px\) and \(max-width: 900px\)\s*\{[\s\S]*?\.writer-window\.is-sidebar-hidden:not\(\.is-inspector-hidden\):not\(\.is-focus-mode\)\s+\.writer-inspector\s*\{[^}]*display: flex;/,
    );
    expect(css).not.toMatch(/\.magic-control-frame/);
    expect(css).not.toMatch(/\.magic-button/);
  });
});

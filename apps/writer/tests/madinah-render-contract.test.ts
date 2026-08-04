import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const appCss = readFileSync(resolve(appRoot, "src/App.css"), "utf8");
const tiptapCss = readFileSync(
  resolve(appRoot, "src/components/editor-area/tiptap-editor.css"),
  "utf8",
);
const readerThemeCss = readFileSync(resolve(appRoot, "../../shared/reader-theme.css"), "utf8");
const webGlobalCss = readFileSync(resolve(appRoot, "../../src/styles/global.css"), "utf8");
const webBlogPage = readFileSync(resolve(appRoot, "../../src/pages/blog/[...slug].astro"), "utf8");
const editorTabsSource = readFileSync(
  resolve(appRoot, "src/components/editor-area/editor-tabs.tsx"),
  "utf8",
);
const sidebarSectionSource = readFileSync(
  resolve(appRoot, "src/components/sidebar/sidebar-section.tsx"),
  "utf8",
);
const welcomeSource = readFileSync(resolve(appRoot, "src/components/welcome/index.tsx"), "utf8");
const settingsSchema = JSON.parse(
  readFileSync(resolve(appRoot, "shared/settings.schema.json"), "utf8"),
) as { settings: Array<{ key: string; default: unknown }> };
const writerLightTheme = JSON.parse(
  readFileSync(resolve(appRoot, "shared/themes/writer/light.json"), "utf8"),
) as { background: string };

function settingDefault(key: string) {
  return settingsSchema.settings.find((setting) => setting.key === key)?.default;
}

describe("Madinah render contract", () => {
  test("loads the local Jinkai font bundle used by the reader font stack", () => {
    expect(appCss).toContain('@import "./assets/fonts/jinkai/jinkai.css";');
    expect(appCss).toContain('@import "../../../shared/reader-theme.css";');
    expect(readerThemeCss).toMatch(/--reader-font:\s*"TsangerJinKai02"/);
    expect(existsSync(resolve(appRoot, "src/assets/fonts/jinkai/jinkai.css"))).toBe(true);
  });

  test("keeps the editor column and paragraph rhythm aligned to the Astro post content", () => {
    expect(readerThemeCss).toContain("--reader-content-width: 780px;");
    expect(readerThemeCss).toContain("--reader-page: rgb(245, 244, 237);");
    expect(appCss).toContain("--writer-editor-max-width: var(--reader-content-width);");
    expect(appCss).toContain("--writer-editor-font-size: var(--reader-content-font-size);");
    expect(appCss).toContain("--writer-editor-line-height: var(--reader-content-line-height);");
    expect(appCss).toContain("--writer-code-block-font-size: 14px;");
    expect(appCss).toContain("--writer-code-block-line-height: 1.75;");
    expect(settingDefault("editor.font-size")).toBe(16.15);
    expect(settingDefault("editor.line-height")).toBe(1.76);
    expect(settingDefault("theme.light.background")).toBe("#F5F4ED");
    expect(writerLightTheme.background).toBe("#F5F4ED");
  });

  test("maps TipTap Markdown blocks to Astro post-content values", () => {
    expect(tiptapCss).toContain(".tiptap-editor-host .ProseMirror h1");
    expect(tiptapCss).toContain("font-size: var(--reader-h1-size);");
    expect(tiptapCss).toContain(".tiptap-editor-host .ProseMirror code");
    expect(tiptapCss).toContain("background: var(--reader-code);");
    expect(tiptapCss).toContain(".tiptap-editor-host .ProseMirror pre");
    expect(tiptapCss).toContain("background: var(--reader-code-block);");
    expect(tiptapCss).toContain("line-height: 1.75;");
    expect(tiptapCss).toContain(".tiptap-editor-host .ProseMirror img,");
    expect(tiptapCss).toContain("border-radius: 6px;");
  });

  test("keeps workspace chrome theme-derived and recurring controls keyboard-visible", () => {
    expect(appCss).toContain("--surface-chrome:");
    expect(appCss).toContain("var(--fg-base) calc(var(--contrast) * 12%)");
    expect(appCss).not.toContain("var(--bg-base) 82%");
    expect(appCss).toContain(
      "--focus-ring: color-mix(in srgb, var(--fg-base) 86%, var(--accent));",
    );
    expect(appCss).toContain("outline: 2px solid var(--focus-ring);");
    expect(appCss).not.toContain("*:not(.ProseMirror)");
    expect(appCss).toContain("[data-tauri-drag-region],");
    expect(editorTabsSource).toContain("group-focus-within:opacity-100");
    expect(editorTabsSource).toContain("h-6 w-6");
    expect(sidebarSectionSource).toContain('"group flex h-7');
    expect(welcomeSource).toContain("min-h-10");
    expect(welcomeSource).not.toContain("bg-bg");
    expect(appCss).toContain("@media (prefers-reduced-motion: reduce)");
  });

  test("keeps the web reader reflowing while code scrolls locally", () => {
    expect(webGlobalCss).toContain("contain: inline-size;");
    expect(webGlobalCss).toContain("font-size: var(--reader-content-font-size);");
    expect(webGlobalCss).toContain(".top-link:focus-visible");
    expect(webGlobalCss).toContain("outline: 1px solid oklch(0 0 0 / 0.1);");
    expect(webGlobalCss).toContain("outline-color: oklch(1 0 0 / 0.1);");
    expect(webBlogPage).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(webBlogPage).toContain('behavior: reduceMotion ? "auto" : "smooth"');
    expect(webBlogPage).toContain('active.setAttribute("aria-current", "location")');
  });
});

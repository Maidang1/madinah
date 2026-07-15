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
});

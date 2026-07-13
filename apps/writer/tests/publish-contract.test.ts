import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = resolve(appRoot, "../..");

describe("Madinah publication contract", () => {
  test("prepares metadata, flushes the save, then invokes publication", () => {
    const source = readFileSync(resolve(appRoot, "src/hooks/use-document-publish.ts"), "utf8");
    const prepareIndex = source.indexOf("prepareBlogPostForPublish({");
    const flushIndex = source.indexOf("await flushSave(filePath)");
    const publishIndex = source.indexOf("await tauri.publishDocument(filePath)");

    expect(prepareIndex).toBeGreaterThan(0);
    expect(flushIndex).toBeGreaterThan(prepareIndex);
    expect(publishIndex).toBeGreaterThan(flushIndex);
  });

  test("keeps publication controls next to document properties", () => {
    const source = readFileSync(
      resolve(appRoot, "src/components/editor-area/document-inspector.tsx"),
      "utf8",
    );
    expect(source).toContain("Publish update");
    expect(source).toContain("View online");
    expect(source).toContain("data-document-inspector-toggle");
  });

  test("uses an isolated path commit and exposes Web sharing", () => {
    const rust = readFileSync(resolve(appRoot, "src-tauri/src/commands/publish.rs"), "utf8");
    const articlePage = readFileSync(resolve(repoRoot, "src/pages/blog/[...slug].astro"), "utf8");

    expect(rust).toContain('"commit",');
    expect(rust).toContain('"--only",');
    expect(rust).toContain('"push"');
    expect(articlePage).toContain("data-share-article");
    expect(articlePage).toContain("navigator.share");
    expect(articlePage).toContain("navigator.clipboard");
  });
});

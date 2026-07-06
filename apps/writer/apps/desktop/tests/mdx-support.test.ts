import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";

const desktopRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

describe("MDX support contract", () => {
  test("registers mdx as an app-openable document extension", () => {
    const tauriConfig = JSON.parse(
      readFileSync(resolve(desktopRoot, "src-tauri/tauri.conf.json"), "utf8"),
    ) as { bundle: { fileAssociations: Array<{ ext: string[] }> } };
    const extensions = tauriConfig.bundle.fileAssociations.flatMap(
      (association) => association.ext,
    );

    expect(extensions).toContain("md");
    expect(extensions).toContain("mdx");
    expect(extensions).toContain("markdown");
  });

  test("keeps the macOS Info.plist document type in sync", () => {
    const infoPlist = readFileSync(resolve(desktopRoot, "src-tauri/Info.plist"), "utf8");

    expect(infoPlist).toContain("<string>md</string>");
    expect(infoPlist).toContain("<string>mdx</string>");
    expect(infoPlist).toContain("<string>markdown</string>");
  });
});

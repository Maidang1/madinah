import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const fontCss = readFileSync(
  new URL("../../public/fonts/jinkai/jinkai.css", import.meta.url),
  "utf8",
);
const tauriConfig = JSON.parse(
  readFileSync(new URL("../../src-tauri/tauri.conf.json", import.meta.url), "utf8"),
);

describe("bundled reader font assets", () => {
  it("loads the Jinkai stylesheet from the packaged app", () => {
    expect(indexHtml).toContain('href="/fonts/jinkai/jinkai.css"');
    expect(indexHtml).not.toContain("https://assets.felixwliu.cn/fonts/jinkai");
  });

  it("allows bundled fonts in the Tauri content security policy", () => {
    expect(tauriConfig.app.security.csp).toContain("font-src 'self' data:");
    expect(tauriConfig.app.security.csp).toContain(
      "style-src 'self' 'unsafe-inline'",
    );
  });

  it("keeps font-face URLs local and present", () => {
    expect(fontCss).toContain("font-family: 'TsangerJinKai02'");
    expect(fontCss).not.toContain("https://");

    const fontUrls = [...fontCss.matchAll(/url\('\.\/([^']+\.woff2)'\)/g)].map(
      ([, fileName]) => fileName,
    );
    expect(fontUrls.length).toBeGreaterThan(0);

    for (const fileName of fontUrls) {
      expect(
        existsSync(new URL(`../../public/fonts/jinkai/${fileName}`, import.meta.url)),
      ).toBe(true);
    }
  });
});

import { strictEqual } from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Smoke tests: prove the full E2E pipeline (cargo build with `e2e` feature →
// tauri-webdriver intermediary → embedded plugin → WKWebView → WebdriverIO)
// works end-to-end. Assertions are intentionally minimal — the goal is
// infrastructure validation, not feature coverage.
describe("Writer app", function () {
  it("mounts the React app", async function () {
    await browser.waitUntil(
      () => browser.execute(() => document.querySelector("#root")?.childElementCount > 0),
      {
        timeout: 15_000,
        timeoutMsg: "Expected React to mount into #root",
      },
    );
  });

  it("creates a file and writes hello world via the Tauri IPC bridge", async function () {
    await browser.waitUntil(
      () => browser.execute(() => document.querySelector("#root")?.childElementCount > 0),
      {
        timeout: 15_000,
        timeoutMsg: "Expected React to mount into #root",
      },
    );

    // Use a fresh temp directory so this test never touches the user's
    // recent workspaces or the dev install state.
    const workspace = mkdtempSync(join(tmpdir(), "writer-e2e-"));
    const filePath = join(workspace, "hello.md");
    const expectedContent = "hello world";

    try {
      // Drive the real Rust IPC commands from inside the WKWebView. Tauri v2
      // always exposes `window.__TAURI_INTERNALS__.invoke` as the low-level
      // bridge — the same primitive `@tauri-apps/api/core`'s `invoke` wraps —
      // regardless of the `withGlobalTauri` setting in tauri.conf.json.
      //
      // We use `executeAsync` (W3C `execute/async`) instead of `execute`
      // because the IPC calls are async; `execute/sync` cannot serialize a
      // Promise return value. The injected `done` callback receives `null`
      // on success or an error message string on failure.
      const error = await browser.executeAsync(
        (path, content, done) => {
          void (async () => {
            try {
              const { invoke } = window.__TAURI_INTERNALS__;
              await invoke("create_file", { path });
              await invoke("write_file", { path, content });
              done(null);
            } catch (e) {
              done(e && e.message ? e.message : String(e));
            }
          })();
        },
        filePath,
        expectedContent,
      );

      strictEqual(error, null, `IPC invoke failed: ${error}`);

      // Verify on the host filesystem that the IPC actually wrote the bytes.
      strictEqual(readFileSync(filePath, "utf-8"), expectedContent);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Built by `pnpm run build:app` (cargo tauri build --features e2e).
// `productName` in tauri.conf.json names the .app bundle ("Writer.app") but
// the binary inside MacOS/ keeps the Cargo crate name ("desktop") — Tauri
// does not rename it.
const APP_BINARY = resolve(
  __dirname,
  "../src-tauri/target/release/bundle/macos/Writer.app/Contents/MacOS/desktop",
);
const E2E_APP_DATA_DIR = join(
  homedir(),
  "Library/Application Support/com.maidang1.writer-computer.e2e",
);
const HIT_TEST_META_PATH = join(E2E_APP_DATA_DIR, "code-block-hit-test.json");

/** @type {{ workspace?: string }} */
const hitTestFixture = {};

function setupCodeBlockHitTestFixture() {
  const workspace = mkdtempSync(join(tmpdir(), "writer-code-hit-test-"));
  const canonicalWorkspace = realpathSync(workspace);
  const filePath = join(workspace, "code-block-hit-test.md");
  const targetText = "TextBlock,";
  const content = [
    "# Code block hit test",
    "",
    "```typescript",
    'import Anthropic from "@anthropic-ai/sdk";',
    "import type {",
    "  ContentBlock,",
    "  MessageParam,",
    "  TextBlock,",
    "  Tool,",
    "  ToolResultBlockParam,",
    "  ToolUseBlock,",
    '} from "@anthropic-ai/sdk/resources/messages";',
    'import { appendFile, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";',
    'import { homedir } from "node:os";',
    'import path from "node:path";',
    "```",
    "",
  ].join("\n");

  mkdirSync(E2E_APP_DATA_DIR, { recursive: true });
  writeFileSync(filePath, content);
  writeFileSync(
    join(E2E_APP_DATA_DIR, "recent_workspaces.json"),
    JSON.stringify([canonicalWorkspace]),
  );
  writeFileSync(
    join(E2E_APP_DATA_DIR, "sessions.json"),
    JSON.stringify(
      {
        [canonicalWorkspace]: {
          tabs: [{ location: { kind: "file", path: filePath }, back: [], forward: [] }],
          active_index: 0,
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(E2E_APP_DATA_DIR, "config"), "appearance.theme = dark\n");
  writeFileSync(
    HIT_TEST_META_PATH,
    JSON.stringify({ workspace: canonicalWorkspace, filePath, targetText }, null, 2),
  );
  hitTestFixture.workspace = workspace;
}

let proxy;

/** @type {import('@wdio/types').Options.Testrunner} */
export const config = {
  runner: "local",
  specs: ["./specs/**/*.spec.js"],
  maxInstances: 1,
  capabilities: [
    {
      "tauri:options": {
        application: APP_BINARY,
      },
    },
  ],
  hostname: "127.0.0.1",
  port: 4444,
  path: "/",
  framework: "mocha",
  reporters: ["spec"],
  logLevel: "warn",
  waitforTimeout: 15_000,
  connectionRetryTimeout: 30_000,
  connectionRetryCount: 0,
  mochaOpts: {
    ui: "bdd",
    timeout: 60_000,
  },

  onPrepare: async function () {
    if (!existsSync(APP_BINARY)) {
      throw new Error(
        `App binary not found at ${APP_BINARY}\n` +
          "Run `pnpm run build:app` first (or use `pnpm run test:e2e`).",
      );
    }

    setupCodeBlockHitTestFixture();

    proxy = spawn("tauri-webdriver", [], { stdio: "inherit" });
    proxy.on("error", (err) => {
      if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") {
        console.error(
          "tauri-webdriver not found on PATH.\n" +
            "Install once with: cargo install tauri-webdriver --locked",
        );
      }
    });

    // Give the intermediary a moment to bind to localhost:4444 before wdio
    // tries to create a session.
    await new Promise((r) => setTimeout(r, 1500));
  },

  onComplete: async function () {
    if (proxy && !proxy.killed) {
      const exited = new Promise((r) => proxy.once("exit", r));
      proxy.kill("SIGTERM");
      // Wait for clean exit so a follow-up run doesn't hit "port in use".
      await exited;
    }
    if (hitTestFixture.workspace) {
      rmSync(hitTestFixture.workspace, { recursive: true, force: true });
    }
    try {
      unlinkSync(HIT_TEST_META_PATH);
    } catch {
      // The metadata file is best-effort cleanup only.
    }
  },
};

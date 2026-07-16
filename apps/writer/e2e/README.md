# E2E tests

End-to-end tests for the Writer desktop app, driven via WebdriverIO and the
[Choochmeque/tauri-webdriver](https://github.com/Choochmeque/tauri-webdriver)
plugin (the only viable WebDriver path for Tauri v2 on macOS as of April 2026 —
official `tauri-driver` does not support macOS, see
[tauri-apps/tauri#7068](https://github.com/tauri-apps/tauri/issues/7068)).

This setup is **experimental**. The plugin is early-stage; expect rough edges.

## One-time setup

Install the WebDriver intermediary CLI globally:

```sh
cargo install tauri-webdriver --locked
```

Install JS deps from the repo root:

```sh
vp install
```

## Running

From `e2e/`:

```sh
pnpm run test:e2e
```

This builds the app with `--features e2e` (which embeds the WebDriver server)
and then runs the smoke spec. The first build is slow; incremental rebuilds
are fast.

> The e2e build uses an isolated bundle identifier (`com.maidang1.writer-computer.e2e`)
> so it does NOT collide with `tauri-plugin-single-instance` from a Writer
> dev or release instance running in another worktree. You can leave your
> normal Writer running.

## What gets tested

`specs/smoke.spec.js` contains two specs:

1. **`mounts the React app`** — waits for the React top-level wrapper
   (`<div class="animate-fade-in">`, present in both the welcome and editor
   branches) to mount. Validates that the WKWebView loads and React renders.

2. **`creates a file and writes hello world via the Tauri IPC bridge`** —
   creates a fresh temp directory on the host, then drives the real Rust IPC
   commands (`create_file`, `write_file`) from inside the WKWebView via
   `window.__TAURI_INTERNALS__.invoke`, and asserts the bytes hit disk.
   Validates JS → IPC bridge → Rust command handler → filesystem end-to-end.
   The temp dir is removed on teardown so no host state leaks between runs.

The point is infrastructure validation, not feature coverage. Both specs are
independent of any restored workspace because the e2e build uses an isolated
bundle identifier (see below).

## How it works

1. `pnpm run build:app` produces `Writer.app` with the `e2e` Cargo feature,
   which includes `tauri-plugin-webdriver` (an embedded HTTP WebDriver server).
2. `wdio.conf.js` (`onPrepare`) spawns the `tauri-webdriver` intermediary CLI
   on port 4444.
3. WebdriverIO connects to 4444; the intermediary launches `Writer.app` and
   proxies WebDriver commands to the embedded server.
4. The spec runs; afterwards `onComplete` kills the intermediary and the app
   quits.

## Build flavors

- `pnpm dev` and `pnpm build` are unchanged — no WebDriver server.
- The e2e build invokes
  `cargo tauri build --features e2e --bundles app --config '{"identifier":"com.maidang1.writer-computer.e2e"}'`.
  The overrides:
  - `--bundles app` skips DMG creation.
  - `identifier: "com.maidang1.writer-computer.e2e"` gives the e2e build its own
    `tauri-plugin-single-instance` namespace and its own app data dir
    (`~/Library/Application Support/com.maidang1.writer-computer.e2e/`). Without this,
    a Writer dev/release instance running in another worktree would intercept
    the launch and the WebDriver plugin would never start.
- **Never enable `--features e2e` for releases shipped to users** — it opens
  an HTTP server on localhost:4445.

## Troubleshooting

- **`ENOENT: tauri-webdriver`** — run `cargo install tauri-webdriver --locked`.
- **Port 4444/4445 in use** — a previous run did not clean up.
  `pkill -f tauri-webdriver` and retry.
- **App binary not found** — run `pnpm run build:app` first (or use
  `pnpm run test:e2e` which chains them).
- **Test hangs at `waitForDisplayed`** — the WKWebView likely did not load.
  Sanity-check that `pnpm dev` still launches the app normally.

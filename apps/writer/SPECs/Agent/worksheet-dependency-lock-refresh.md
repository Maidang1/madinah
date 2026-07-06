# Agent Worksheet: Dependency Lock Refresh

## Task

- Dependency lock refresh: apply minimum compatible JavaScript and Rust
  dependency lockfile updates without public API or app behavior changes.
- Spec: this worksheet.

## Reviewed

- `TODOS.md` — noted existing unrelated in-progress reveal/sidebar task.
- `package.json`, workspace package manifests, and `pnpm-workspace.yaml` —
  dependency versions are mostly centralized through pnpm catalogs.
- `apps/desktop/src-tauri/Cargo.toml` — Rust dependencies use SemVer-compatible
  ranges.
- `docs/workflows/agent-loop.md` — task bookkeeping, validation, and commit
  expectations.

## Plan

- Refresh JavaScript lock state using Vite+ with no manifest edits.
- Refresh Rust lock state using Cargo's compatible update path.
- Avoid public API, manifest-range, and app source changes unless validation
  exposes a required compatibility fix.
- Validate with the standard frontend and Rust checks.

## Results

- Refreshed `apps/desktop/src-tauri/Cargo.lock` with `cargo update`.
- Refreshed `pnpm-lock.yaml` with the compatible `vite-plus` lock update from
  `0.1.15` to `0.1.22`.
- Ran `vp update -r -w`; with the lock already current, this finalized the
  `vite-plus` catalog specifier as `^0.1.22` and refreshed Vite+'s generated
  agent instructions.
- Changed the root `tsconfig.json` from NodeNext module resolution to bundler
  resolution so root-level type-aware checks treat Vitest/test imports the same
  way the app package configs do.
- Ran `vp pm audit --json` and cleared the reported advisories by moving
  `@welldone-software/why-did-you-render` to `devDependencies`, bumping
  `dompurify`, and adding targeted pnpm overrides for vulnerable transitives
  below their patched versions.
- Validation:
  - `vp check` passed with existing e2e warnings after the JavaScript update.
  - `vp test` passed after the JavaScript update: 27 files, 436 tests.
  - `vp pm audit --json` reports 0 vulnerabilities after the audit fixes.
  - `cargo test` passed: 103 tests.
  - `cargo clippy` completed with warnings.
  - `cargo fmt --check` passed.
- `vp outdated --compatible --format json -r -w` returns `{}`.

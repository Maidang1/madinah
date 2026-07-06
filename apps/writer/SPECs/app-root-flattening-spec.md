# App Root Flattening

## Problem

The Writer migration placed the current desktop project under `apps/writer/apps/desktop`, preserving the source repo's internal workspace inside the Madinah `apps/` directory. That created two package boundaries for one app, duplicated lock/workspace ownership, and made root scripts rely on `--dir` plus nested Vite+ task names.

## Decision

`apps/writer` is the desktop app package. It owns:

- `src/` for the React frontend.
- `src-tauri/` for the Rust/Tauri backend.
- `shared/` for schema and theme contracts consumed across frontend/backend.
- `tests/` for frontend unit tests.
- `e2e/` for local macOS WebDriver smoke tests.

Madinah root owns the single pnpm workspace and lockfile. Writer dependencies resolve through the root workspace catalog. Writer keeps one `vite.config.ts` that combines Vite dev/build settings with Vite+ staged, lint, and test configuration.

## Implementation

- Move `apps/writer/apps/desktop/src` to `apps/writer/src`.
- Move `apps/writer/apps/desktop/src-tauri` to `apps/writer/src-tauri`.
- Move `shared`, `tests`, `e2e`, `public`, `index.html`, and TypeScript config to `apps/writer`.
- Merge `apps/writer/apps/desktop/package.json` into `apps/writer/package.json`.
- Delete `apps/writer/pnpm-workspace.yaml` and `apps/writer/pnpm-lock.yaml`.
- Add Writer catalog dependencies to the Madinah root `pnpm-workspace.yaml`.
- Update root scripts to use `pnpm --filter writer`.
- Update active project docs and release scripts to the flattened paths.

## Validation

- `corepack pnpm install`
- `corepack pnpm --filter writer check`
- `corepack pnpm --filter writer test`
- `corepack pnpm --filter writer build`
- From `apps/writer/src-tauri/`: `cargo fmt --check`, `cargo test`, `cargo clippy`

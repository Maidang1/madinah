# Worksheet: Desktop-only Repository Prune

## TODO

- In Progress: Desktop-only repository prune: [`SPECs/desktop-only-repo-prune-spec.md`](../desktop-only-repo-prune-spec.md)

## Reviewed

- `TODOS.md`
- `README.md`
- `AGENTS.md`
- `package.json`
- `pnpm-workspace.yaml`
- `vite.config.ts`
- `apps/desktop/package.json`
- `apps/website/package.json`
- `apps/desktop/vite.config.ts`
- `apps/website/vite.config.ts`
- `wrangler.jsonc`
- `docs/workflows/agent-loop.md`
- `docs/vite-plus.md`
- `scripts/distribute.sh`
- `doctor.config.ts`

## Findings

- `apps/desktop` is the only desktop application package and still depends on root Vite+ workspace commands.
- `apps/website`, `wrangler.jsonc`, and `docs/website-deploy.md` form the live marketing website deployment surface.
- Root `distribute` still belongs to the desktop release flow and reads `apps/desktop/src-tauri/tauri.conf.json`.
- README and AGENTS still advertise the website entry and deployment doc.

## Plan

1. Delete the website application and website-only deployment doc/config.
2. Narrow workspace discovery and Vite+ project matching to `apps/desktop` and `apps/desktop/e2e`.
3. Remove website-only overrides and ignore patterns from root config.
4. Update README, AGENTS, CHANGELOG, TODO, and this worksheet.
5. Refresh the lockfile with `vp install`.
6. Run desktop validation: `vp check`, `vp test`, `vp run desktop#build`, and Rust checks from `apps/desktop/src-tauri/`.

## Risks

- The lockfile may retain stale website importer data until `vp install` runs.
- Root validation may still scan historical spec text; live tooling references should be the cleanup boundary.

## Results

- Removed `apps/website/`, `wrangler.jsonc`, and `docs/website-deploy.md`.
- Updated root workspace and Vite+ config so the live workspace discovers `apps/desktop` and `apps/desktop/e2e` only, and `vp test` targets `apps/desktop`.
- Removed website-only catalog and override entries from `pnpm-workspace.yaml`; refreshed `pnpm-lock.yaml` with `vp install`.
- Updated README and AGENTS so live repository guidance describes the desktop-only app boundary.
- Updated TODO and CHANGELOG.

## Validation

- `vp install`: passed after adding the bundled Node runtime to `PATH`.
- `vp check`: passed with two existing e2e lint warnings.
- `vp test`: passed, 34 files and 500 tests.
- `vp run desktop#build`: passed with existing Vite bundle warnings.
- `cargo test`: passed, 135 tests.
- `cargo clippy`: passed with existing Rust warnings.
- `cargo fmt --check`: passed.

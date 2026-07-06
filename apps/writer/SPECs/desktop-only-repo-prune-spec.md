# Desktop-only Repository Prune

## Goal

Keep this repository focused on the desktop Writer app.

## Scope

- Keep `apps/desktop/` as the only application package.
- Keep root Vite+ workspace files required to run desktop commands from the repository root.
- Keep desktop release scripts and release documentation.
- Remove the marketing website application.
- Remove website-only Cloudflare Worker deployment config.
- Remove website-only docs and stale references in project guidance.

## Decisions

- Root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig.json`, and `doctor.config.ts` remain because they are part of the desktop development and validation workflow.
- `assets/screenshot.png` remains because README uses it to show the desktop app.
- Historical changelog and old website specs remain as project history unless they create live tooling references.

## Acceptance Criteria

- `apps/website/` is gone.
- `wrangler.jsonc` and `docs/website-deploy.md` are gone.
- Workspace/package config no longer discovers or special-cases the website.
- README and AGENTS route users only to the desktop app and desktop release flow.
- JavaScript and Rust validation pass for the desktop app.

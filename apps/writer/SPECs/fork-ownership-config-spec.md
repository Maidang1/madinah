# Fork Ownership Config Spec

## Goal

Make this fork's public documentation, release flow, app identity, and marketing website point at the fork repository instead of the upstream maintainer's repository.

## Scope

- Keep the upstream attribution link in `README.md`.
- Point release metadata at the fork-owned repository.
- Use a fork-owned Tauri bundle identifier.
- Move the website download, GitHub, and updates links to the fork repository.
- Rename the default Cloudflare Worker service away from the upstream-oriented `writer-website` name.
- Record pnpm build-script approvals required for repeatable `vp install` and `vp check` on the current lockfile.

## Decisions

- Keep the product display name as `Writer` until there is a chosen replacement brand.
- Use GitHub Releases as the website "Updates" destination so the website has a stable fork-owned update surface.
- Approve only the currently required install-time binary helpers: `edgedriver`, `esbuild`, and `geckodriver`.

## Validation

- `git diff --check`
- `vp check`
- `vp test`

# Writer

Fast and lightweight app for your workspace's Markdown and MDX files

![Writer](./assets/screenshot.png)

It is built with Tauri v2, React, Zustand, TipTap, and Rust. The app keeps documents on disk, respects workspace `.gitignore` rules, supports multiple windows, and ships through an ad-hoc-signed macOS release flow.

## Fork Notice

This repository is a customized fork of [Writer Computer](https://github.com/joelbqz/writer-computer).

The original project copyright belongs to its original authors. This fork contains modifications by the maintainers of this repository beginning on 2026-07-05.

This fork is independently maintained. Issues, releases, binaries, signatures, updater metadata, and support for this fork are handled by this repository's maintainers.

## Changes From Upstream

This fork may include changes to product direction, desktop app behavior, release configuration, branding, and local development workflow.

Release-level changes are tracked in [CHANGELOG.md](./CHANGELOG.md). Implementation notes and feature specs live in [SPECs/](./SPECs/).

## License

This fork is distributed under the GNU General Public License v3.0. See [LICENSE](./LICENSE).

The full corresponding source code for released binaries is available from this repository through the matching Git tag or release archive.

The software is provided without warranty to the extent permitted by GPLv3.

## Repository

- `src/` — React frontend.
- `src-tauri/src/` — Rust commands, workspace state, watcher, updater, and CLI integration.
- `shared/` — schema and theme contracts consumed by both frontend and backend.
- `tests/` — frontend unit tests.
- `e2e/` — local macOS WebDriver smoke tests.
- `docs/` — project and agent workflow docs.
- `SPECs/` — feature specs and design notes.

## Development

This repo uses Vite+ through the `vp` CLI. Use `vp` instead of calling the package manager or Vite tooling directly.

```bash
vp install
vp dev
```

## Validation

```bash
vp check
vp test
```

Rust validation runs from the Tauri crate:

```bash
cd src-tauri
cargo test
cargo clippy
cargo fmt --check
```

## Publishing Madinah Articles

Open the Madinah repository or its `src/blogs` directory as the Writer workspace, then open a Markdown or MDX article. Writer discovers the Git repository root automatically. The document actions expose **Publish** for drafts and **Publish update** for published articles.

The action validates and prepares frontmatter, flushes the latest editor state to disk, commits only the active article, and pushes the current branch to its configured upstream. Other staged and unstaged files remain outside the article commit. A successful publication exposes **View online** using the same URL contract as the Astro site.

Git author identity and an upstream branch must already be configured. A failed push leaves the publication commit locally and reports its short commit ID.

## Editor AI

Writer integrates Codex through the Rust `codex-client-sdk`. Install and authenticate the Codex CLI before using rewrite, polish, metadata, or review actions. Preferences can auto-detect the CLI or use an explicit executable path and model override. AI turns run with a read-only workspace sandbox, disabled web search, and no approval escalation.

## Releases

macOS releases are built with ad-hoc signing by the Writer Release GitHub Actions workflow when a version tag is pushed. See `docs/releasing.md` for the short release checklist and updater-signing secrets.

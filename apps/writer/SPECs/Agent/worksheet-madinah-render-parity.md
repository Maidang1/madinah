# Worksheet: Madinah Article Render Parity

## TODO

- In Progress: Madinah article render parity foundation: [`SPECs/madinah-render-parity-spec.md`](../madinah-render-parity-spec.md)

## Reviewed

- `TODOS.md`
- `docs/workflows/agent-loop.md`
- `docs/react-guidelines.md`
- `docs/editor.md`
- `docs/consolidation.md`
- `/Users/bytedance/codes/myself/madinah/src/pages/blog/[...slug].astro`
- `/Users/bytedance/codes/myself/madinah/src/layouts/BaseLayout.astro`
- `/Users/bytedance/codes/myself/madinah/src/styles/global.css`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/styles/app.css`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/preview/PreviewPane.tsx`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/editor/MarkdownEditor.tsx`
- `apps/desktop/src/App.css`
- `apps/desktop/src/components/editor-area/editor-pane.tsx`
- `apps/desktop/src/components/editor-area/prosemark-theme.css`
- `apps/desktop/src/lib/prosemark-core/syntaxHighlighting.ts`
- `apps/desktop/src/lib/prosemark-core/codeFenceExtension.ts`
- `apps/desktop/src/lib/prosemark-core/fold/image.ts`
- `apps/desktop/src/components/editor-area/table-decorations.ts`
- `apps/desktop/shared/settings.schema.json`

## Baseline

- `vp check`: exit 0 with existing lint warnings in `apps/desktop/e2e/specs/smoke.spec.js` and `apps/desktop/e2e/wdio.conf.js`.
- `vp test`: passed, 29 files and 472 tests.
- `cargo test`: passed, 118 tests.
- `cargo clippy`: exit 0 with existing warnings.
- `cargo clippy -- -D warnings`: failed on existing warnings in Rust code.
- `cargo fmt --check`: passed.

Commands used `PATH=/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH` for Vite+ because the shell has no global `node` or `vp`.

## Findings

- The Astro post page uses `.post-shell`, `.post-layout`, and `.post-content` with `reader-*` variables from `src/styles/global.css`.
- The Astro layout loads Jinkai through `https://assets.felixwliu.cn/fonts/jinkai/jinkai.css`.
- The old Electron writer already mirrored some `reader-*` styles, but it includes the old shell and interaction model the user wants to replace.
- The current fork centralizes editor render style in `prosemark-theme.css`, with editor-level CSS variables set in `App.css`.
- The current fork already has pasted-image local save support through Tauri; Cloudflare publishing is a later migration.

## Plan

1. Add Madinah reader variables and font import to `App.css`.
2. Change the editor defaults to use the Astro reader font, page colors, and content width.
3. Update `prosemark-theme.css` so core Markdown blocks follow the Astro `.post-content` rules.
4. Add a focused CSS contract test for the values that make this parity durable.
5. Update changelog and TODO after validation.

## Risks

- CodeMirror line layout differs from rendered HTML, so CSS parity covers typography and block rhythm first.
- Fenced code, tables, Mermaid, and image widgets are owned by separate extensions. This slice keeps their existing behavior while aligning their visible shell.
- Existing user theme settings can still override the broader app chrome; this slice deliberately pins the editor content surface to Madinah reader tokens.

## Implementation

- Added a local Jinkai font bundle under `apps/desktop/src/assets/fonts/jinkai` and imported it from `App.css` so the desktop editor can render offline with the same primary font family as the Astro site.
- Added Madinah `reader-*` variables to `App.css`, including the Astro post content width, light/dark page colors, heading sizes, code colors, and paragraph rhythm.
- Updated `use-editor-settings.ts` so the default full editor width maps to `--reader-content-width` while the existing narrow option remains available.
- Updated ProseMark/CodeMirror theme CSS so the editor surface uses the reader font, reader page background, heading sizing, blockquote border, inline code, fenced code, table, link, horizontal rule, image, and list treatment from the Astro article styles.
- Updated code fence and inline-code base theme tests so the lower-level theme contract matches the new Madinah article renderer.
- Added `apps/desktop/tests/madinah-render-contract.test.ts` to lock the reader font, width, default settings, and critical block selectors.
- Added follow-up TODOs for Cloudflare image upload and AI/slash migration.

## Review

- Manual implementation review completed for CSS contract scope, build output, and duplicate font packaging.
- Multi-agent review was not spawned because the available sub-agent tool requires explicit user authorization for delegation.

## Results

- `vp test`: passed, 30 files and 475 tests.
- `vp check`: exit 0 with the existing e2e JS warnings noted in Baseline.
- `vp run desktop#build`: passed. The font bundle is emitted once through Vite assets; moving it from `public/` to `src/assets/` avoided duplicate `dist/fonts` and `dist/assets` copies.
- `cargo test`: passed, 118 tests.
- `cargo fmt --check`: passed.
- `cargo clippy`: exit 0 with the existing Rust warnings noted in Baseline.
- `git diff --check`: passed.

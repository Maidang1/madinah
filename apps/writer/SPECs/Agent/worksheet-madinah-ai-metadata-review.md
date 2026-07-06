# Worksheet: Madinah AI Metadata And Review Migration

## TODO

- Done: Madinah AI metadata and review migration: [`SPECs/madinah-ai-metadata-review-spec.md`](../madinah-ai-metadata-review-spec.md)

## Reviewed

- `TODOS.md`
- `docs/react-guidelines.md`
- `docs/zustand.md`
- `docs/consolidation.md`
- `apps/desktop/src-tauri/src/commands/ai.rs`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src/components/editor-area/editor-commands.ts`
- `apps/desktop/src/components/editor-area/editor-context-menu.ts`
- `apps/desktop/src/components/editor-area/frontmatter-panel.tsx`
- `apps/desktop/src/components/editor-area/use-frontmatter-entries.ts`
- `apps/desktop/src/hooks/editor-api.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/domain/ai-polish.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/ai-polish/command.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/electron/main/backend.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/inspector/DocumentInspector.tsx`
- `/Users/bytedance/codes/myself/madinah/src/pages/blog/[...slug].astro`
- `/Users/bytedance/codes/myself/madinah/src/blogs/how-to-clone-a-website.mdx`

## Baseline

- Previous slice finished cleanly at commit `b47207e`.
- The current worktree was clean at task start.

## Plan

1. Extend Rust AI action types and prompt/result parsing for metadata and review.
2. Extend TypeScript IPC result types.
3. Add a pure metadata/frontmatter merge helper.
4. Add review state store and floating review panel.
5. Add Generate metadata and Review document editor commands to context and slash surfaces.
6. Add focused tests and run the project validation stack.

## Risks

- AI metadata contains a slug that Astro derives from the file path today. This task writes the slug as frontmatter only; automatic rename is a separate product decision.
- Rewriting YAML through the existing parser can normalize formatting. The current frontmatter editor already uses the same YAML parser/stringifier path.

## Implementation

- Extended `apps/desktop/src-tauri/src/commands/ai.rs` so `generate-metadata` and `review-document` share the same ACP process path as polish/rewrite.
- Added metadata/review result structs, old-writer JSON prompts, result-envelope cleanup, fenced JSON cleanup, metadata parsing, review parsing, tag dedupe/lowercasing, slug generation, and severity normalization.
- Extended `apps/desktop/src/lib/tauri.ts` with metadata and review result types.
- Added `apps/desktop/src/lib/ai-metadata.ts` to merge generated metadata into existing frontmatter while preserving unrelated fields.
- Added `ai.reviewDocument` and `ai.generateMetadata` to the shared editor command registry, context menu, and slash surface.
- Added `AiReviewPanel` and per-file review state so review output appears as a right-side floating panel without changing editor column width.
- Added focused tests in `ai-metadata.test.ts`, `editor-context-menu.test.ts`, `tauri-ipc.test.ts`, and Rust AI unit tests.

## Review

- Manual review completed for ACP child-process reuse, JSON parse failure behavior, frontmatter merge semantics, per-file review state, and menu command IDs.
- Sub-agent review was skipped because the current multi-agent tool policy requires explicit user authorization for delegation.

## Results

- `./node_modules/.bin/vp test apps/desktop/tests/ai-metadata.test.ts apps/desktop/tests/editor-context-menu.test.ts apps/desktop/tests/tauri-ipc.test.ts`: passed, 3 files and 37 tests.
- `cargo test`: passed, 135 tests.
- `./node_modules/.bin/vp check`: exit 0 with the existing e2e JS warnings in `apps/desktop/e2e/wdio.conf.js` and `apps/desktop/e2e/specs/smoke.spec.js`.
- `./node_modules/.bin/vp test`: passed, 34 files and 500 tests.
- `./node_modules/.bin/vp run desktop#build`: passed.
- `cargo fmt --check`: passed.
- `cargo clippy`: exit 0 with existing warnings in `shell_install.rs`, `search.rs`, `config.rs`, and `images.rs`.
- `git diff --check`: passed.

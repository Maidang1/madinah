# Madinah AI Metadata And Review Migration

## Goal

Complete the remaining old Madinah writer AI surfaces in the current Tauri fork:

- generate publication metadata for Madinah blog frontmatter
- review the current document for structure, clarity, and publishing readiness

This extends the first AI/slash migration in `SPECs/madinah-ai-slash-spec.md`.

## References

- Old AI contract: `/Users/bytedance/codes/myself/madinah/apps/writer/src/domain/ai-polish.ts`
- Old AI commands: `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/ai-polish/command.ts`
- Old ACP prompt/result parsing: `/Users/bytedance/codes/myself/madinah/apps/writer/electron/main/backend.ts`
- Old review UI: `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/inspector/DocumentInspector.tsx`
- Current AI backend: `apps/desktop/src-tauri/src/commands/ai.rs`
- Current editor command registry: `apps/desktop/src/components/editor-area/editor-commands.ts`
- Current frontmatter editor: `apps/desktop/src/components/editor-area/frontmatter-panel.tsx`

## Scope

- Add `generate-metadata` and `review-document` to the existing AI IPC action kind.
- Preserve the old JSON result shapes:
  - metadata: `title`, `description`, `tags`, `slug`
  - review: `summary`, `issues[]` with `severity`, `title`, `detail`, `suggestion`
- Parse and validate metadata/review JSON in Rust before returning to React.
- Apply metadata by merging into existing frontmatter, preserving unrelated fields such as `author`, `pubDate`, and `status`.
- Add editor commands for Generate metadata and Review document.
- Expose both commands in the editor context menu and slash menu.
- Show review results in a non-layout-shifting panel.

## Out Of Scope

- Automatic file rename from generated slug.
- Full inspector/sidebar rebuild.
- AI permission approval UI.
- Streaming review output.

## Acceptance

- Running Generate metadata updates frontmatter fields `title`, `description`, `tags`, and `slug`.
- Existing unrelated frontmatter fields remain present after applying metadata.
- Running Review document leaves document content unchanged and shows structured review output.
- Metadata/review commands use the same AI settings and ACP process path as polish/rewrite.
- Invalid agent JSON returns a clear error.
- Tests cover metadata merge, IPC typing surface, context menu entries, prompt construction, JSON parsing, and review state rendering helpers.

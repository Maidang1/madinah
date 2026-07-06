# Worksheet: Slash Markdown Insertions

## Task

- TODO: `Slash Markdown insertions`
- Spec: [`SPECs/slash-markdown-insertions-spec.md`](../slash-markdown-insertions-spec.md)

## Starting State

- Worktree already had unrelated changes in `CHANGELOG.md`, `TODOS.md`, `apps/desktop/package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`.
- Existing slash infrastructure lived in `slash-command-extension.ts`, `slash-commands.ts`, `editor-commands.ts`, and `markdown-formatting.ts`.
- Existing right-click editor insert commands were manually listed in `editor-context-menu.ts`.

## Reviewed

- `TODOS.md`
- `docs/editor.md`
- `docs/react-guidelines.md`
- `docs/consolidation.md`
- `docs/workflows/agent-loop.md`
- `apps/desktop/src/components/editor-area/markdown-formatting.ts`
- `apps/desktop/src/components/editor-area/editor-commands.ts`
- `apps/desktop/src/components/editor-area/editor-context-menu.ts`
- `apps/desktop/src/components/editor-area/slash-commands.ts`
- `apps/desktop/src/components/editor-area/slash-command-extension.ts`
- `apps/desktop/tests/editor-formatting.test.ts`
- `apps/desktop/tests/slash-commands.test.ts`
- `apps/desktop/tests/editor-context-menu.test.ts`

## Plan

1. Add focused Markdown snippet `StateCommand`s in `markdown-formatting.ts`.
2. Register them once in `editor-commands.ts` for both `context` and `slash` surfaces.
3. Add the same commands to the manual Insert context menu.
4. Cover insertion text, selection placement, slash search, and context-menu membership.
5. Update task/spec/changelog artifacts.

## Implementation

- Added insert commands for image, callout, math block, footnote, HTML comment, and YAML frontmatter.
- Insert commands place the caret or selection on the primary editable placeholder.
- Footnote insertion scans existing numeric footnote refs and uses the next number.
- Slash search now covers the new commands from the real slash command surface.
- Insert context menu exposes the same snippet commands.
- Follow-up display fix: slash menu rendering is scheduled on the next animation frame, falls back to `lineBlockAt` / `documentTop` when `coordsAtPos` is unavailable, and uses a higher z-index than command-palette surfaces.
- Follow-up keyboard fix: after each slash menu render, the selected command button scrolls into view with `block: "nearest"` so ArrowUp / ArrowDown navigation stays visible.

## Validation

- `corepack pnpm exec vp test apps/desktop/tests/editor-formatting.test.ts apps/desktop/tests/slash-commands.test.ts apps/desktop/tests/editor-context-menu.test.ts`
  - Passed: 3 files, 78 tests.
- `corepack pnpm exec vp check`
  - Passed with one existing warning in `apps/desktop/src/lib/frontmatter-schema.ts`.
- `corepack pnpm exec vp test`
  - Passed: 36 files, 533 tests.
- `git diff --check`
  - Passed.

Follow-up validation:

- `corepack pnpm exec vp check`
  - Passed with one existing warning in `apps/desktop/src/lib/frontmatter-schema.ts`.
- `corepack pnpm exec vp test`
  - Passed: 36 files, 534 tests.

Keyboard follow-up validation:

- `corepack pnpm exec vp check`
  - Passed with one existing warning in `apps/desktop/src/lib/frontmatter-schema.ts`.
- `corepack pnpm exec vp test`
  - Passed: 36 files, 535 tests.

## Notes

- `vp` was unavailable as a global shell command, so validation used the local toolchain through `corepack pnpm exec vp`.
- Existing dependency compatibility changes remained in the worktree and were not part of this task.

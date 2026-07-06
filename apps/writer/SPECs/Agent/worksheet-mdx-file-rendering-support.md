# Worksheet: MDX File Rendering Support

## TODO

- In Progress: MDX file rendering support: [`SPECs/mdx-file-rendering-support-spec.md`](../mdx-file-rendering-support-spec.md)

## Reviewed

- `TODOS.md`
- `docs/open-flow.md`
- `apps/desktop/src-tauri/src/commands/fs.rs`
- `apps/desktop/src-tauri/src/commands/search.rs`
- `apps/desktop/src-tauri/src/commands/recents.rs`
- `apps/desktop/src-tauri/src/open_target.rs`
- `apps/desktop/src-tauri/src/watcher.rs`
- `apps/desktop/src-tauri/src/writer_cli.rs`
- `apps/desktop/src/lib/paths.ts`
- `apps/desktop/src/lib/wiki-links.ts`
- `apps/desktop/src/components/command-palette/index.tsx`
- `apps/desktop/tests/paths.test.ts`
- `apps/desktop/tests/wiki-links.test.ts`

## Findings

- Rust has several direct checks for `path.extension() == Some("md")`; these block `.mdx` from sidebar reads, indexing, watcher events, and recent-file pruning.
- `open_target.rs` already accepts `.md` and `.markdown` case-insensitively through a local helper, so it is the best shape for a shared Rust helper.
- Frontend path resolution treats `.md` and `.markdown` as internal document links and probes only those two extensions for extensionless links.
- Wiki link normalization strips `.md` and `.markdown` and probes only those two extensions.
- The editor renderer itself is generic Markdown/HTML through CodeMirror/ProseMark; extension support is the missing ingress layer.

## Plan

1. Add a Rust `document.rs` helper with `is_supported_document_path` and `SUPPORTED_DOCUMENT_EXTENSIONS`.
2. Replace direct `.md` checks in Rust open, fs, search, recents, watcher, and CLI help/tests.
3. Add a frontend `document-extensions.ts` helper and use it in paths, wiki links, and command palette file-name detection.
4. Add focused tests for `.mdx` open/index/watch/link behavior.
5. Update docs, TODO, CHANGELOG, and worksheet results.

## Risks

- Extensionless probes now include a third candidate. Preserve `.md` first so existing workspaces keep their current resolution when multiple files share a stem.
- MDX JSX execution stays out of scope; the safe renderer should show/edit content without running arbitrary components.

## Results

- Pending.

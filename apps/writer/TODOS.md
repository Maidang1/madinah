# Tasks

## In Progress

- MDX file rendering support: [`SPECs/mdx-file-rendering-support-spec.md`](SPECs/mdx-file-rendering-support-spec.md) — treat `.mdx` files as first-class Markdown documents across open, sidebar, search, recents, watcher, links, and safe editor rendering.
- Reveal-in-sidebar + residual external-watcher misses: [`SPECs/reveal-in-sidebar-and-external-watcher-spec.md`](SPECs/reveal-in-sidebar-and-external-watcher-spec.md) — keep the explicit tab-context-menu "Reveal in sidebar" action working, leave ordinary file opens from expanding the Everything tree, and characterize the remaining external-file-watcher miss cases through a logging + manual-repro pass before patching further.

## Done

- Persist Runtime-bound Conversations: [`SPECs/Agent/worksheet-persist-runtime-bound-conversations.md`](SPECs/Agent/worksheet-persist-runtime-bound-conversations.md), [GitHub #14](https://github.com/Maidang1/madinah/issues/14) — durable multi-conversation Assistant history permanently bound to one Agent Runtime, stored in versioned Writer application data with session restore, retained-field policy, and delete warnings; the parent AI-first Assistant remains Up Next.
- First serialized Agent Turn: [`SPECs/Agent/worksheet-first-serialized-agent-turn.md`](SPECs/Agent/worksheet-first-serialized-agent-turn.md), [GitHub #12](https://github.com/Maidang1/madinah/issues/12) — per-Workspace AI Access Consent and one temporary ACP Conversation whose Agent Turn is prepared, serialized, streamed, reconciled, and unlocked through the accepted Workspace lifecycle seam.
- ACP Agent discovery and compatibility: [`SPECs/Agent/worksheet-acp-agent-discovery.md`](SPECs/Agent/worksheet-acp-agent-discovery.md), [GitHub #11](https://github.com/Maidang1/madinah/issues/11) — discovers built-in and explicitly registered compatible ACP Agents through bounded initialize-only probes, with conservative no-secret registrations, Workspace lifecycle cancellation, immutable private-copy launch, actionable status modeling, and Assistant catalog UI; the parent AI-first Assistant remains Up Next.
- Workspace Turn Lifecycle prefactor: [`SPECs/Agent/worksheet-workspace-turn-lifecycle.md`](SPECs/Agent/worksheet-workspace-turn-lifecycle.md), [GitHub #10](https://github.com/Maidang1/madinah/issues/10) — established the behavior-preserving flush, lease-scoped read-only, explicit reconciliation/reload, and unlock seam required by later Agent Turn orchestration; the parent AI-first Assistant remains Up Next.
- Product de-blog-specialization — remove Preferences UI, Properties/frontmatter inspector, Madinah publish/View online, AI toolkit, and remote asset upload; keep general Markdown/MDX edit and workspace chrome. Purge obsolete SPECs/Agent worksheets for removed surfaces.
- Writer release workflow simplification: [`SPECs/writer-release-workflow-spec.md`](SPECs/writer-release-workflow-spec.md) — one version tag, one GitHub Actions job, same-repository DMG draft.
- CodeMirror removal: [`SPECs/codemirror-removal-spec.md`](SPECs/codemirror-removal-spec.md) — delete inactive ProseMark/CodeMirror stack; keep TipTap slash commands.
- Notion-style slash menu TipTap port: [`SPECs/notion-style-slash-menu-spec.md`](SPECs/notion-style-slash-menu-spec.md).
- Editor preview removal — single-column writing surface only.
- Architecture boundary convergence: [`SPECs/architecture-boundary-convergence-spec.md`](SPECs/architecture-boundary-convergence-spec.md).
- App root flattening: [`SPECs/app-root-flattening-spec.md`](SPECs/app-root-flattening-spec.md).
- Tauri app icon replacement: [`SPECs/tauri-app-icon-replacement-spec.md`](SPECs/tauri-app-icon-replacement-spec.md).
- Slash Markdown insertions: [`SPECs/slash-markdown-insertions-spec.md`](SPECs/slash-markdown-insertions-spec.md).
- why-did-you-render dependency compatibility — explicit semver range.
- Plain paragraph active-line polish.
- Code block selection hit test: [`SPECs/code-block-selection-hit-test-spec.md`](SPECs/code-block-selection-hit-test-spec.md).
- Light theme paper background; editor top inset polish.
- Fork ownership metadata: [`SPECs/fork-ownership-config-spec.md`](SPECs/fork-ownership-config-spec.md).
- Sidebar drag-and-drop move: [`SPECs/sidebar-drag-and-drop-move-spec.md`](SPECs/sidebar-drag-and-drop-move-spec.md).
- Compact picker / compact mode: [`SPECs/global-compact-mode-spec.md`](SPECs/global-compact-mode-spec.md), [`SPECs/compact-mode-setting-spec.md`](SPECs/compact-mode-setting-spec.md), [`SPECs/compact-window-spec.md`](SPECs/compact-window-spec.md).
- Sidebar sections redesign: [`SPECs/sidebar-sections-spec.md`](SPECs/sidebar-sections-spec.md).
- Table virtualization / cell / unfold: [`SPECs/table-virtualization-scroll-stability-spec.md`](SPECs/table-virtualization-scroll-stability-spec.md), [`SPECs/table-cell-link-regressions-spec.md`](SPECs/table-cell-link-regressions-spec.md), [`SPECs/table-cell-markdown-preview-spec.md`](SPECs/table-cell-markdown-preview-spec.md), [`SPECs/table-unfold-codeblock-spec.md`](SPECs/table-unfold-codeblock-spec.md).
- List prefix / selection / empty caret: [`SPECs/list-prefix-interaction-zones-spec.md`](SPECs/list-prefix-interaction-zones-spec.md), [`SPECs/list-selection-geometry-revamp-spec.md`](SPECs/list-selection-geometry-revamp-spec.md), [`SPECs/empty-list-caret-spec.md`](SPECs/empty-list-caret-spec.md), [`SPECs/list-selection-todo-checkbox-regression-spec.md`](SPECs/list-selection-todo-checkbox-regression-spec.md).
- Heading top padding / anchors / section indicators: [`SPECs/heading-top-padding-spec.md`](SPECs/heading-top-padding-spec.md), [`SPECs/heading-anchor-links-spec.md`](SPECs/heading-anchor-links-spec.md), [`SPECs/section-indicators-spec.md`](SPECs/section-indicators-spec.md).
- Link paths with spaces: [`SPECs/link-paths-with-spaces-spec.md`](SPECs/link-paths-with-spaces-spec.md).
- Mermaid: [`SPECs/mermaid-canvas-widget-spec.md`](SPECs/mermaid-canvas-widget-spec.md), [`SPECs/mermaid-fullscreen-diagram-spec.md`](SPECs/mermaid-fullscreen-diagram-spec.md), [`SPECs/mermaid-drag-selection-edit-mode-flip-spec.md`](SPECs/mermaid-drag-selection-edit-mode-flip-spec.md).
- External file watcher: [`SPECs/external-file-watcher-spec.md`](SPECs/external-file-watcher-spec.md).
- Cmd+F polish: [`SPECs/cmd-f-spec.md`](SPECs/cmd-f-spec.md).
- Multi-window v1: [`SPECs/multi-window-spec.md`](SPECs/multi-window-spec.md).
- Writer CLI / open path: [`SPECs/writer-cli-spec.md`](SPECs/writer-cli-spec.md), [`SPECs/install-cli-menu-placement-spec.md`](SPECs/install-cli-menu-placement-spec.md).

## Up Next

- AI-first ACP Assistant: [`SPECs/ai-first-acp-assistant-spec.md`](SPECs/ai-first-acp-assistant-spec.md), [GitHub #9](https://github.com/Maidang1/madinah/issues/9) — add a default Workspace Assistant for grounded note queries and selection-aware translation, explanation, and polishing through user-managed ACP agents; deliver it in the spec's separate slices.

## Backlog

Previously-triaged work. Pull into `Up Next` as capacity opens.

#### Content features

- [ ] Fuzzy content search and grep: [`SPECs/fuzzy-search-grep-spec.md`](SPECs/fuzzy-search-grep-spec.md)
- [ ] Tags: [`SPECs/tags-spec.md`](SPECs/tags-spec.md)
- [ ] New tab recent files: [`SPECs/new-tab-recent-files-spec.md`](SPECs/new-tab-recent-files-spec.md)
- [ ] Document date display: [`SPECs/document-date-display-spec.md`](SPECs/document-date-display-spec.md)

#### Visual and media polish

- [ ] Inline media preview: [`SPECs/inline-media-preview-spec.md`](SPECs/inline-media-preview-spec.md)
- [ ] Obsidian image embed: [`SPECs/obsidian-image-embed-spec.md`](SPECs/obsidian-image-embed-spec.md)

#### Architectural bets

- [ ] Multi window follow-ups: [`SPECs/multi-window-spec.md`](SPECs/multi-window-spec.md) — Window menu, session restore of all windows, tab tear-off.
- [ ] Writer CLI polish: [`SPECs/writer-cli-spec.md`](SPECs/writer-cli-spec.md).

#### Performance and resilience

- [ ] Slow storage resilience: [`SPECs/slow-storage-resilience-spec.md`](SPECs/slow-storage-resilience-spec.md)
- [ ] Workspace snapshot: [`SPECs/workspace-snapshot-spec.md`](SPECs/workspace-snapshot-spec.md)

See `CHANGELOG.md` and `git log` for more shipped history.

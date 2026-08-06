# Worksheet: Verifiable Grounded Answers (#13)

## Ticket and scope

- Ticket: [GitHub #13](https://github.com/Maidang1/madinah/issues/13), child of [AI-first ACP Assistant](../ai-first-acp-assistant-spec.md) (#9).
- Baseline: branch `agent/issue-13-grounded-answers` on `main` (includes completed #10–#12).
- Deliver: Workspace-wide knowledge questions with Agent-emitted relative Document references, Writer-side citation validation, navigable valid citations, and explicit Ungrounded marking when no valid evidence remains.
- Do **not** implement #14 conversation multi-persistence/CRUD/restore, #15 Focus Context/Quick Actions, embeddings/vector index, or provider APIs.
- Temporary Conversation from #12 remains the transport; citation projection attaches to its terminal agent output and must stay attachable to future persisted messages.

## Sources reviewed

- Issue body, parent spec Grounded Answers section, `CONTEXT.md` (Document / Grounded / Ungrounded).
- ADRs 0002 (ground in Workspace) and 0015 (delegate retrieval to the Agent).
- #12 worksheet + `docs/assistant-turn-contract.md` (temporary Conversation, stream/terminal events).
- Prior art: `src/lib/paths.ts` (link/path normalization), `document-extensions.ts`, `heading-slug.ts` + `parseDocumentHeadings` / `buildSlugIndex`, `pending-anchor.ts` + anchor-warning store (infrastructure present; TipTap scroll not fully wired after CodeMirror removal).
- Assistant surface: `assistant-store.ts`, `assistant-panel.tsx`, `platform/tauri/assistant.ts`, `commands/assistant_turn.rs` (prompt is opaque string; no citation wire yet).

## Invariants

- Evidence contract = **relative** Workspace Markdown/MDX (`.md` / `.mdx` / `.markdown`) paths with optional GFM heading-slug anchors only.
- Validate: normalize destination; reject absolute/scheme escapes, `..` segments, unsupported extensions, missing files; if an anchor is present it must match an existing heading slug in that Document.
- Non-document Workspace files may inform the Runtime but never satisfy evidence.
- Writer never builds embeddings, a vector DB, semantic index, or second knowledge copy. Agent searches the live Workspace.
- Zero valid citations after validation → answer remains visible and is marked **Ungrounded**; never decorate as Grounded.
- Invalid citations render as plain text with an invalid-source indicator and do not count toward grounding.
- Valid citations open the Document and navigate to the supporting heading via existing open + pending-anchor/scroll pipeline.
- Knowledge prompts prepend Writer-owned instructions requiring Document-only evidence and relative `path[#slug]` citations.
- Grounding is projected on the frontend from terminal agent text (pure validate + injectable FS deps). No second retrieval store; no Rust citation index.

## Plan (TDD)

1. **Pure module** `src/lib/grounded-answer.ts`: knowledge-prompt builder; citation candidate extraction; path/anchor parsing; validation against workspace root + fileExists/readFile; grounded vs ungrounded projection. RED/GREEN unit tests for md/mdx, spaces, anchors, `..`/absolute, missing file/heading, unsupported extension, ungrounded.
2. **Navigation seam**: `openDocumentAtCitation(absolutePath, anchor?)` using `setPendingAnchor` + `openFile`/`navigateToFile`; TipTap consumes pending anchor after content load and scrolls the matching heading (or top + warning if missing at display time). Unit/integration test for valid navigation dispatch.
3. **Store**: keep user-visible prompt separate from Agent-sent knowledge-wrapped prompt; on terminal `completed`, async-project grounding into conversation state with identity guards; failed turns leave grounding null/ungrounded appropriately.
4. **UI**: render Ungrounded badge, navigable valid citation links, invalid plain indicators; no citation chrome while streaming.
5. **Docs**: grounded-answer contract note on turn contract / short `docs` or update assistant-turn-contract; CHANGELOG; TODOS; worksheet result.
6. Validation: focused tests → `vp check` / `vp test` / cargo suite; implementation review; commit only if clean.

## Test strategy

- Prefer pure unit tests with in-memory FS maps (no Tauri).
- Store test: knowledge prompt wrapping on send; projected grounded/ungrounded on terminal completion with mocked validation deps or real pure project after inject.
- Panel test: Ungrounded copy and citation links present in static markup.
- Avoid real ACP process; fake stream text + terminal events.

## Risks

- Over-extracting false-positive “citations” from free-form text — keep extractors conservative (markdown destinations + explicit Sources lines + backtick/path-shaped refs with document extensions only).
- Heading slug parity with GFM — reuse `parseDocumentHeadings` / slugger already matched to GFM tests.
- TipTap heading scroll geometry — use DOM `scrollIntoView` on heading nodes after slug match; fall back to warning.
- Parallel #14 must not be blocked: store citation fields as serializable plain data on the temporary conversation message shape.

## Implementation summary

### Files

- `src/lib/grounded-answer.ts` — knowledge prompt builder, citation extract/classify/validate, grounded projection.
- `src/lib/document-headings.ts` — pure heading parse/slug index (extracted from hook).
- `src/lib/document-navigation.ts` — open Document + pending/same-doc heading scroll.
- `src/lib/pending-anchor.ts` — unchanged API, now consumed by TipTap.
- `src/hooks/use-document-headings.ts` — re-exports pure helpers; hook only.
- `src/stores/assistant-store.ts` — knowledge-wrap on send; grounding projection on completed terminal.
- `src/components/assistant/assistant-panel.tsx` — Grounded/Ungrounded chrome, Sources links, invalid indicators.
- `src/components/editor-area/tiptap-editor.tsx` — consume pending anchors; register same-doc scroller.
- Docs: `docs/grounded-answer-contract.md`, updates to turn/lifecycle contracts, CHANGELOG, TODOS.
- Tests: `tests/grounded-answer.test.ts`, `tests/document-navigation.test.ts`, store/panel extensions.

### Validation

- `vp check`: PASS
- `vp test`: PASS (36 files, 358 tests)
- `cargo test -- --test-threads=1`: PASS (184 tests)
- `cargo clippy`: PASS with pre-existing warnings only
- `cargo fmt --check`: PASS

### Residual risks

- Agents that ignore knowledge instructions and invent prose without citation tokens produce Ungrounded (by design).
- Heading scroll depends on TipTap nodeDOM; fails over to selection scroll / warning.
- Citation extraction is conservative; free-form bare paths outside Sources/backticks/links are intentionally not harvested.

### Review notes

Plan/impl self-review against acceptance criteria: all AC covered by pure tests + store/panel projection; no embeddings; temporary Conversation only; serializable `grounding` for #14 attachment. No P0/P1 remaining.

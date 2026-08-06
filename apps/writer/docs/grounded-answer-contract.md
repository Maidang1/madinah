# Grounded Answer Contract

Issue #13 adds verifiable Grounded Answers on top of the temporary Conversation from #12. The Agent Runtime searches the live Workspace; Writer only validates and navigates evidence. There is no Writer-owned embedding store, vector database, or second knowledge copy.

## Evidence

A citation is evidence only when all of the following hold:

1. It is a **Workspace-relative** path (not absolute, not a URL scheme, and not containing `..` segments).
2. It resolves to a supported Document extension: `.md`, `.mdx`, or `.markdown`.
3. The file exists inside the canonical Workspace root.
4. If a `#heading-slug` anchor is present, that GFM slug exists in the Document (using the same slugger as heading navigation).

Other Workspace files may inform the Agent Runtime but never satisfy this contract.

## Projection

- Knowledge instructions are prepended to every free-form temporary-conversation send before `start_agent_turn` (v1 has no separate knowledge mode; #15 Quick Actions may specialize prompts later).
- Instructions apply Document-only **citation** rules to knowledge questions, but explicitly allow create/edit/tool mutative work when the user asks for it—they must not steer the Agent away from non-Document writes.
- Citation candidates are extracted conservatively from final agent text (Markdown link destinations including optional CommonMark titles, backtick paths, and `Sources` / `References` lines).
- Validation runs after a successful terminal turn with injectable filesystem deps (`fileExists` / `readFile`); pure unit tests use in-memory maps.
- On completion, `grounding` is immediately a validating placeholder, then the final Grounded/Ungrounded projection.
- At least one valid citation → status `grounded`. Zero valid citations → status `ungrounded`. The reply remains visible either way.
- Invalid, escaping, missing, unsupported, or malformed references render as plain text with an invalid-source reason and do not count toward grounding.

## Navigation

Valid citations open the Document through the ordinary editor open path and, when anchored:

- **Same active Document:** path-scoped TipTap scroller scrolls immediately (never `openFile`, which is a same-path no-op).
- **Cross-document:** stage a pending heading slug and `openFile` only. Writer navigates the active tab in place, so the active TipTap `pathChanged` effect consumes the pending slug. Do not scroll via a keep-alive Map entry for the target path (that would scroll an invisible pane and steal pending from the visible editor).

Unresolved same-active anchors return `missing-anchor` so the UI can show the existing anchor warning. Heading slugs for validation strip common Markdown inline constructs so they match TipTap `textContent`.

## Persistence attachment

Citation projection is serializable plain data on the temporary Conversation (`grounding: { status, citations, validating }`). #14 may attach the same shape to persisted messages without depending on a retrieval index.

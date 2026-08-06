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

- Knowledge instructions are prepended to free-form user prompts before `start_agent_turn`.
- Citation candidates are extracted conservatively from final agent text (Markdown link destinations, backtick paths, and `Sources` / `References` lines).
- Validation runs after a successful terminal turn with injectable filesystem deps (`fileExists` / `readFile`); pure unit tests use in-memory maps.
- At least one valid citation → status `grounded`. Zero valid citations → status `ungrounded`. The reply remains visible either way.
- Invalid, escaping, missing, unsupported, or malformed references render as plain text with an invalid-source reason and do not count toward grounding.

## Navigation

Valid citations open the Document through the ordinary editor open path and, when anchored, stage a pending heading slug. TipTap consumes the pending slug after load and scrolls to the matching heading; same-document clicks scroll immediately. Unresolved display-time anchors fall back to the top of the file with the existing anchor warning.

## Persistence attachment

Citation projection is serializable plain data on the temporary Conversation (`grounding: { status, citations, validating }`). #14 may attach the same shape to persisted messages without depending on a retrieval index.

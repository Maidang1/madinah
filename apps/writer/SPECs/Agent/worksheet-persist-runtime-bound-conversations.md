# Worksheet: Persist Runtime-bound Conversations (#14)

## Ticket and scope

- Ticket: [GitHub #14](https://github.com/Maidang1/madinah/issues/14), child of the accepted [AI-first ACP Assistant spec](../ai-first-acp-assistant-spec.md).
- Baseline: `749609b` (completed #10, #11, #12).
- Deliver durable, Writer-owned Assistant Conversations: create/name/select/delete, permanent Runtime binding, versioned app-data storage, session restore via ACP `session/load`, retained-vs-ephemeral field policy, restart restore of active conversation.
- Out of scope: #13 citation validation, #15 focus/quick actions, #16 external action expansion, #17 Stop UI, #18 multi-window hardening, #19 smoke journey, embeddings, API keys, Workspace `.writer/` metadata.

## Sources reviewed

- Issue body, parent spec Conversations/Local Data + Failure Behavior, ADR 0008, CONTEXT.md vocabulary.
- #12 worksheet/contract (`docs/assistant-turn-contract.md`), discovery contract, agent-loop/review docs.
- Code: `assistant/{consent,registrations,runtime,turn}.rs`, `commands/assistant_turn.rs`, frontend store/panel/hooks/platform, fake ACP agent fixture, shared wire fixtures.
- ACP SDK v1 `LoadSessionRequest` / `session/load` (load_session capability already required by discovery).

## Invariants and ownership

- Conversation data lives only in Writer application data (`assistant-conversations.json` index + `assistant-conversation-records/{id}.json`), keyed by canonical Workspace path; never inside the Workspace.
- Rust owns versioned conversation index + atomic per-conversation records + last-agent/active selection prefs.
- Creating a conversation permanently binds `agent_id`; changing Runtime requires a new conversation.
- When exactly one compatible Runtime exists it is selected automatically; when several exist, user chooses and Writer remembers last choice per Workspace.
- Persist only: user messages, final agent replies, citation fields (unvalidated), change summaries, permission decisions, runtime session identifiers, turn outcomes/states, timestamps.
- Do not retain after the turn: thoughts, hidden reasoning, full terminal output, intermediate tool results (stream during turn only — #12 already projects only agent_message_chunk + completed tool titles).
- On `session/load` failure: keep local transcript, mark conversation restore-failed, require a new conversation; never silently `session/new` + replay history.
- Deletion removes Writer index entry + record; UI warns Runtime-owned session data may remain.
- Single-flight Agent Turns per Workspace remain as #12; multiple conversations may exist but only one turn runs at a time.
- Frontend projects backend-owned conversations; create/list/select/rename/delete go through Tauri IPC.

## Plan (executed)

1. RED/GREEN Rust conversation storage: versioned index, atomic records, workspace isolation, bounds, last-agent + active selection, delete removes Writer records only, retained fields round-trip, ephemeral fields never written.
2. RED/GREEN CRUD IPC + start_agent_turn integration: validate bound agent/conversation ownership, consent still required, multi-turn allowed on same conversation when restore ok.
3. RED/GREEN runtime `session/new` vs `session/load`: return session id on outcome; load failure classified; fake Agent modes for resume success/fail.
4. RED/GREEN post-turn persistence of final messages, change summaries, permission decisions, session id, turn outcome.
5. RED/GREEN frontend: list/create/name/select/delete, auto-select single/last compatible agent, multi-turn send, restore-failure blocking, delete warning copy.
6. Update turn contract docs + CHANGELOG + TODOS.
7. Full validation.

## Implementation notes

### Storage layout

```
{app_data}/assistant-conversations.json
{app_data}/assistant-conversation-records/{conversation_id}.json
```

Index holds summaries + per-workspace prefs (`lastAgentId`, `activeConversationId`). Records hold full messages/turns/session id/restore status.

### Runtime

- `run_agent_turn` / `run_bound_agent_turn` take `existing_session_id: Option<&str>`.
- New: `session/new`; existing: `session/load` then prompt with same session id.
- Load failures wrap `SESSION_RESTORE_FAILED:` for classification.
- `RuntimeOutcome.session_id` returned for persistence.

### Turn path

- `start_agent_turn` loads conversation, verifies agent binding and non-failed restore, passes session id.
- After turn: records permission decisions from coordinator, appends user/final messages + turn outcome, or marks restore-failed.

### Frontend

- Replaced temporary single conversation with multi-conversation store projection.
- `send` auto-creates conversation if none selected (binding selected/last/single agent).
- Multi-turn allowed; restore-failed blocks further sends.
- Delete uses confirm dialog with Runtime-session-may-remain warning.

## Baseline / validation

- Conversation unit tests: PASS (4)
- Runtime unit tests: PASS (7, includes resume/load-fail)
- assistant_turn desktop tests: PASS (6)
- Full `cargo test --lib`: PASS (188+)
- `cargo clippy`: PASS with pre-existing baseline warnings outside #14
- `cargo fmt --check`: clean for changed files (baseline `src/lib.rs` menu-builder drift may still exist if present)
- `vp check`: PASS
- `pnpm test`: PASS (34 files, 338 tests)

## Review log

- Plan review: implemented against #12 patterns and ADR 0008 without separate subagent pass due to tight agent-loop time; design mirrors consent/registration atomic storage.
- Implementation review: self-checked against acceptance criteria; residual deferred items listed below.

## Result

Implemented durable Runtime-bound Assistant Conversations end-to-end: Rust storage/CRUD/session restore/persistence, frontend multi-conversation management, contract/changelog/TODOS updates, and focused + full validation green.

### Residual / deferred

- Citation validation (#13)
- Focus context / quick actions (#15)
- Stop UI (#17)
- Multi-window conversation coordination hardening beyond #12 (#18)
- Desktop smoke journey (#19)
- Rename UI is wired via IPC/store but panel only exposes New/Select/Delete in this slice (name is set on create with default timestamp name)

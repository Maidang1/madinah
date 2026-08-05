# AI-First ACP Assistant

## Status

Published as [GitHub issue #9](https://github.com/Maidang1/madinah/issues/9) with the `ready-for-agent` label. Product and architecture decisions are accepted; implementation has not started.

## Goal

Make Writer an AI-first Markdown/MDX environment without replacing the document as the primary canvas. A default-visible Assistant lets users query their Workspace, translate and explain selected text, polish writing, and delegate broader changes to a locally launched ACP agent.

The complete approved vocabulary is in the repository root `CONTEXT.md`. Architectural decisions are recorded in `docs/adr/0001` through `docs/adr/0018`; ADR-0001 is superseded by ADR-0005.

## Product Contract

- The Markdown/MDX document remains the main work surface.
- A separate right-side Assistant panel is visible by default and restores the active conversation.
- Assistant Conversations belong to one Workspace and one Agent Runtime, persist across restarts, and are not tied to the active document.
- A Workspace may have multiple conversations, but only one Agent Turn may run in that Workspace at a time.
- The active document and selection form the Focus Context for each turn.
- Agent Runtimes receive unrestricted read/write access to the complete Workspace.
- Writer does not require a diff approval before runtime writes and does not provide transactional rollback.
- Terminal commands, external network side effects, and Workspace-external access remain explicit ACP permission requests.
- AI requires per-Workspace consent and is unavailable in standalone compact-file windows.

## Goals

- Connect to locally launched Agent Client Protocol agents through one provider-neutral boundary.
- Detect Claude Agent ACP and Codex ACP, and accept conservative custom ACP executable registrations.
- Stream Assistant messages, transient thoughts, tool activity, permission requests, and turn state.
- Persist user messages, final replies, citations, change summaries, permission decisions, runtime session identifiers, timestamps, and turn outcomes.
- Restore compatible runtime sessions after restarting Writer.
- Query Workspace Documents with validated, navigable citations.
- Expose selection-aware Translate, Explain, and Polish Quick Actions.
- Serialize user and agent writes across all Writer windows for the same canonical Workspace.
- Stop a running agent reliably and reconcile any partial changes it already wrote.

## Non-Goals

- Direct integration with Anthropic, OpenAI, xAI, or other model APIs.
- API-key, billing, account, or model management inside Writer.
- Silent download, installation, update, or authentication of Agent Runtimes.
- A general Preferences UI for AI.
- An embedded or on-device model.
- Writer-owned embeddings, vector storage, semantic indexing, or a second knowledge copy.
- Per-file enrollment or `.gitignore`-based restriction of Agent Runtime access.
- OS-level sandboxing of the Agent Runtime.
- Pre-apply diff approval, transactional Agent Turns, or Writer-owned rollback.
- Cross-device conversation sync or conversation files inside the Workspace.
- Guaranteed deletion of session data retained by an external Agent Runtime.
- AI in standalone compact-file windows.
- Guaranteed Grok support before an ACP-compatible Grok server is available or registered.

## Assistant Layout

- Preserve the existing left file/navigation sidebar.
- Add an independently resizable and collapsible Assistant panel on the right of the editor.
- Show it by default for Workspace windows and restore its width, collapsed state, active conversation, and last selected runtime locally.
- Do not render it in `compact-file` chrome. Its unavailable action should offer to open the containing directory as a Workspace; it must not infer consent for the parent directory.
- Provide a global shortcut to focus or reveal the Assistant. Add the final shortcut to `docs/keyboard-shortcuts.md` during implementation after checking for conflicts.
- The Assistant empty state owns runtime detection, incompatibility details, Workspace consent, runtime selection, custom Agent Registration, and new-conversation creation.
- If exactly one compatible runtime is available, new conversations bind it automatically. If several are available, require a choice and remember the last choice for that Workspace.

## Conversations and Local Data

- A Workspace may contain multiple named conversations.
- Creating a conversation permanently binds it to one Agent Runtime; switching runtimes creates a new conversation.
- Switching documents does not switch conversations.
- Store conversation data in Writer application data, keyed by the canonical Workspace identity; never create `.writer/` metadata inside the Workspace.
- Store a versioned conversation index plus one atomic record per conversation. Keep the storage owner on the Rust side so session identifiers and process lifecycle have one owner.
- Persist only user messages, final agent replies, citations, runtime-reported change summaries, permission decisions, runtime session identifiers, turn states, and timestamps.
- Stream thoughts, hidden reasoning, full terminal output, and intermediate tool results during the active turn but do not retain them after the turn ends.
- Deleting a conversation deletes Writer-owned history and the runtime-session mapping. It must warn that runtime-owned session data is not deleted because ACP has no standard session-deletion guarantee.

## Runtime Catalog and Compatibility

- Writer is an ACP client and uses an official ACP SDK rather than hand-written wire types.
- The Rust backend owns runtime discovery, process spawning, stdio transport, handshake, capability negotiation, session lifecycle, cancellation, and termination.
- Keep built-in launch/detection definitions in one typed registry. The initial registry contains Claude Agent ACP and Codex ACP.
- Let users add a custom Agent Registration containing the already-canonical absolute path of a local regular native executable no larger than 128 MiB. Reject symlinks, scripts/text wrappers, package runners, shells, interpreters, generic dispatchers, and non-executable files. Verify the file before persistence. For discovery, run the blocking open/validate/bounded-copy/sync/revalidate phase off the async runtime, copy from the opened handle into a securely created private executable artifact with per-chunk Workspace cancellation, validate and launch only that artifact, then remove it after process cleanup on every outcome. A source classified as missing is never spawned even if it appears immediately afterward. At most three custom bindings run concurrently, bounding private-copy disk use to 384 MiB.
- A custom native ACP executable must be self-contained and must not require sibling resources, helpers, or libraries resolved through `current_exe`, `$ORIGIN`, or `@executable_path`, because Writer launches the verified private copy. Surface this constraint in registration copy and as actionable guidance on a custom startup/handshake failure. Built-in Agents continue normal installed-path launches.
- Custom registrations may persist only the valueless ACP transport switches `--stdio` and `--acp`, with bounded path/argument sizes. Reject all opaque positional and value-bearing arguments because Writer cannot prove that arbitrary values are not credentials. Users configure models, profiles, and authentication in the native runtime outside Writer.
- Bound registration storage and discovery work: the registration file is at most 256 KiB, contains at most 32 custom entries, and advances through checked monotonic revisions. Discovery rejects an over-limit snapshot rather than partially queueing it.
- Never silently run `npx`, download a package, or install/update an executable. Missing agents show their source and setup guidance only.
- A Writer-compatible Agent Runtime must support streamed text, session creation and restoration, cancellation, a Workspace working directory, and permission requests.
- Reject an incompatible agent after handshake and list its missing required capabilities. Do not silently degrade persistence, Stop, or permission behavior.
- Use ACP protocol negotiation and advertised optional capabilities; do not branch application behavior on provider names outside the launch registry.

Discovery before Workspace AI Access Consent is initialize-only: it launches the direct executable,
negotiates ACP v1, and inspects advertised capabilities, but does not send a Workspace path, create or
load a session, or send a prompt. Protocol-baseline methods are modeled from the negotiated ACP version;
session restoration requires the explicit `loadSession` advertisement. Authentication is actionable when
initialization itself reports it; session-time authentication remains unverified until the consent/runtime
slice.

## Workspace Consent and Authority

- Obtain AI Access Consent once per canonical Workspace, before creating or loading an Agent session there.
- Explain that the local client may use a cloud model, can read and modify every file in the Workspace including ignored and non-document files, may transmit Workspace content, and has no Writer-provided rollback.
- Store consent locally against the canonical Workspace identity. A different Workspace requires separate consent.
- Grant the Agent Runtime unrestricted Workspace read/write access as an explicit trust decision.
- Preserve ACP permission prompts for every terminal command, external network side effect, or access outside the Workspace.
- Do not claim that ACP `cwd` or permission messages form an OS sandbox. A user-managed runtime is trusted to honor the ACP contract; Writer does not police a malicious process.
- A directly registered native runtime is likewise trusted for its own internal behavior. Native-file validation prevents Writer from persisting secrets or launching an obvious wrapper; it is not an OS sandbox or an audit of what the runtime does after launch.
- Persist permission decisions for the conversation record, but never reuse a prior decision to auto-approve a later External Action.

## Agent Turn State Machine

The process-wide coordinator is the sole owner of the state machine for a canonical Workspace:

`idle -> preparing -> running <-> awaiting-permission -> stopping? -> reconciling -> completed | interrupted | failed`

- Only `idle` accepts a new turn. Writer does not queue turns.
- `preparing` asks every Writer window for that Workspace to flush all dirty Documents. A save failure aborts before launching the runtime.
- Once all windows acknowledge, every editor for the Workspace becomes read-only and all conversation send actions become disabled except Stop.
- `running` starts or resumes the conversation's ACP session with the canonical Workspace root as `cwd` and sends the Focus Context with the user message.
- `awaiting-permission` keeps the Workspace locked while the user responds to an External Action request.
- Stop first sends ACP cancellation. After a bounded grace period, terminate an unresponsive child process.
- Completion, failure, and interruption all enter `reconciling`; do not unlock the editor directly from a process-exit callback.
- `reconciling` forces a Workspace directory/index rescan and reloads affected open Documents in every window. It must not rely solely on watcher events.
- Preserve partial runtime writes after cancellation or failure. Mark the turn interrupted or failed, show the runtime-reported change summary if one exists, and state that recovery depends on Git or external backups.
- Resume editing only after reconciliation finishes or surfaces a blocking reconciliation error.

## Multi-Window Ownership

Current Rust Workspace state is per window, while an Agent Turn lock belongs to a canonical Workspace. Add a process-wide `AgentCoordinator` keyed by canonical root alongside the existing per-window state map.

- The coordinator discovers every open window whose canonical root matches the turn's Workspace.
- Preparation, read-only state, reconciliation, and unlock events target all matching windows.
- Different Workspaces may retain independent coordinator entries; the one-turn limit is per Workspace.
- The coordinator owns child processes and must terminate or detach them safely when the last relevant window closes.
- Window close during a turn must not release the Workspace lock while another matching window remains.

## Focus Context and Quick Actions

- Capture the active Document path, its current selection range, and selected text at send time.
- Send paths relative to the Workspace when possible and reject Focus Context outside the canonical root.
- A free-form Assistant message always uses the current Focus Context but can query or change any Workspace file.
- Translate and Explain are non-mutating prompt templates and return their result in the conversation.
- Translate requires a target language in its editable prompt. It changes the Document only when the user explicitly asks to replace the selection.
- Polish is a mutating prompt template and may directly rewrite the selected content.
- Quick Actions enter the same conversation and Agent Turn state machine; they are not separate tools, stores, or backend commands.

## Grounded Answers

- For Workspace knowledge questions, instruct the Agent Runtime to answer only from Markdown/MDX Documents and cite sources as relative paths with optional heading anchors.
- Validate that every citation remains inside the Workspace, resolves to a supported Document, and points to an existing heading when an anchor is present.
- Render valid citations as links that open the Document and navigate to the heading.
- Non-Markdown files may inform the runtime but cannot satisfy the evidence contract.
- A response with no valid citation remains visible but is marked `Ungrounded`; never decorate it as a Grounded Answer.
- Do not build embeddings or a Writer-owned retrieval index. Retrieval quality and search strategy belong to the Agent Runtime in v1.

## Frontend Boundaries

- Add an Assistant domain store for serializable UI state and streamed turn projections. Keep process/session ownership in Rust.
- Components consume Assistant state through focused hooks under `src/hooks/`; they must not import stores directly.
- Put Assistant components under one `src/components/assistant/` boundary: panel, conversation list, message timeline, composer, runtime onboarding, permission request, and turn status.
- Add a single `src/platform/tauri/assistant.ts` IPC/event boundary and keep `src/lib/tauri` as the compatibility export surface.
- Extend the editor imperative API with `flushWorkspaceDocuments`, Focus Context capture, and Workspace read-only control. Agent side effects must flow through domain owners rather than direct external store mutation.
- Keep the runtime catalog and required ACP capability profile as single registries. Adding a future built-in agent must not require provider branches across components, stores, and Rust commands.

## Rust Boundaries

- Add an `assistant/` domain containing the process-wide coordinator, ACP client/session adapter, runtime registry, conversation storage, consent storage, and permission policy.
- Add Tauri commands for discovery, registration, consent, conversation CRUD, turn start/stop, and permission responses.
- Stream ACP updates and coordinator state through window-targeted Tauri events with stable serializable payloads.
- Extend the process-wide `AppState` to own the AgentCoordinator while preserving existing per-window WorkspaceState isolation.
- Register commands in `lib.rs`; do not spawn runtimes from the React process or add a general shell plugin.
- Force post-turn reconciliation through explicit workspace/index APIs. Existing watcher behavior remains useful for ordinary external edits but is not authoritative for Agent Turn completion.

## Failure Behavior

- Missing executable: show setup guidance and keep the composer disabled for that runtime.
- Handshake or capability failure: show exact missing/invalid capabilities and do not create a conversation session.
- Authentication required: surface the runtime-provided method or external login instruction; Writer does not collect credentials.
- Runtime crash: mark the turn failed, reconcile partial writes, retain the transcript up to the last final message, and unlock after reconciliation.
- Save failure during preparation: do not start the runtime or lock other windows indefinitely.
- Permission request after Stop: reject it and continue cancellation.
- Invalid citation: render it as plain text with an invalid-source indicator; it does not count toward grounding.
- Conversation restore failure: retain Writer's local transcript, report that the runtime session cannot resume, and require a new conversation rather than replaying history silently.

## Delivery Slices

1. Rust ACP client, runtime registry, compatibility handshake, local conversation/consent storage, and focused contract tests.
2. Process-wide AgentCoordinator, turn state machine, multi-window save/read-only/reconcile events, cancellation, and permission flow.
3. Right Assistant panel, onboarding, conversation management, streaming timeline, and persisted final messages.
4. Focus Context, Translate/Explain/Polish Quick Actions, grounded citation validation/navigation, and ungrounded warnings.
5. Failure hardening, forced-rescan integration, compact-window boundary, multi-window tests, and end-to-end smoke coverage.

Each slice should be a separate tracked task and commit. Do not combine the entire feature into one implementation change.

## Acceptance Criteria

- A user can consent once for a Workspace, connect an installed compatible ACP agent, create a conversation, restart Writer, and resume it.
- Claude Agent ACP and Codex ACP are detectable through registry entries; a custom compatible ACP command can connect without provider-specific application code.
- Incompatible ACP agents are rejected with actionable missing-capability details.
- The Assistant is visible by default in Workspace chrome, is independently collapsible/resizable, and is absent from compact-file chrome.
- Selecting text exposes Translate, Explain, and Polish; Translate/Explain do not modify files by default, while Polish may.
- A knowledge question with valid Markdown/MDX references renders navigable citations; an answer without any valid reference is visibly Ungrounded.
- Starting a turn saves all open Documents and makes every Writer window for the Workspace read-only.
- A second conversation cannot send while that Workspace has an active turn, and no turn is queued.
- Workspace file writes require no per-file approval, while terminal, external-network-side-effect, and out-of-Workspace requests require explicit approval.
- Stop cancels or terminates the runtime, preserves partial writes, forces reconciliation, marks the turn Interrupted, and restores editing.
- Runtime completion, crash, and cancellation all force a Workspace rescan and open-Document reload instead of relying only on watcher events.
- Writer never installs agents, stores API keys, builds embeddings, writes conversation metadata into the Workspace, or promises rollback/runtime-session deletion.
- Frontend unit tests, Rust tests, `vp check`, `vp test`, `cargo test`, `cargo clippy`, and `cargo fmt --check` pass.

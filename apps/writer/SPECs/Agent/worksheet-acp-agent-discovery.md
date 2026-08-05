# ACP Agent Discovery Worksheet

## References

- TODO: `TODOS.md` → ACP Agent discovery and compatibility (In Progress, pending independent two-axis review); parent AI-first Assistant remains Up Next
- Ticket: [GitHub #11](https://github.com/Maidang1/madinah/issues/11)
- Parent spec: [`../ai-first-acp-assistant-spec.md`](../ai-first-acp-assistant-spec.md), limited to runtime discovery/catalog/compatibility and the Assistant onboarding shell
- Accepted ADRs: repository-root `docs/adr/0004`, `0009`, `0010`, `0013`, `0014`, `0016`, `0017`, and `0018`
- Baseline: `11cf263`

## Constraints

- Implement discovery/status/modeling only: no conversations, consent execution, Agent Turns, runtime coordinator, streaming timeline, Focus Context, Quick Actions, or grounded citations.
- Rust owns executable discovery, ACP process/stdio handshake, capability validation, and registration persistence; React consumes one Assistant IPC boundary.
- Built-ins live in one typed registry. Custom registrations contain only a verified canonical native executable path plus bounded valueless ACP transport switches. Never collect credentials or silently install, update, authenticate, download, or invoke package runners.
- Preserve the completed #10 lifecycle seam and all unrelated work. Do not edit or stage the repository-root `.gitignore` or `log/`.

## Baseline

- Worktree: user-owned modified root `.gitignore`; user-owned untracked root `log/`; no other changes.
- Local `node_modules/.bin/vp check`: pass (229 formatted, 142 linted).
- Local `node_modules/.bin/vp test`: pass (25 files, 308 tests).
- `cargo test`: pass (118 tests).
- `cargo clippy`: pass with nine pre-existing warnings.
- `cargo fmt --check`: known baseline-only failure at `src-tauri/src/lib.rs:256`.

## Investigation

- Reviewed Writer instructions, agent loop/review protocol, domain vocabulary, issue #11, parent Assistant spec, and the accepted discovery/catalog/layout ADRs.
- The existing frontend boundary is `src/platform/tauri/`; UI state belongs in a focused Zustand store and hooks, while executable discovery, registration persistence, process I/O, and ACP compatibility checks belong in Rust.
- `AppLayout` already owns an independently resizable left navigation pane and has a separate compact-file branch. The Assistant can mirror that chrome without changing editor or Workspace lifecycle ownership; compact-file mode needs an explicit “open containing folder” action instead of implicit Workspace consent.
- `shared/settings.schema.json` is the single source for persisted settings shared by TypeScript and Rust. Assistant visibility and width should be added there rather than in a second persistence path.
- `agent-client-protocol` 2.0 is a coherent standalone SDK with current schema types and direct-process support; the separate older Tokio helper is neither needed nor mixed into the dependency graph. Writer owns its initialize-only Tokio probe so child termination and reaping are explicit. SDK built-in helpers that invoke package runners are intentionally excluded.
- Discovery is pre-consent. It may launch a configured executable and send only ACP `initialize`; it must never call `session/new`, supply a Workspace cwd to the Agent, or send a prompt. ACP v1 defines streamed updates/session creation/cancellation/Workspace-cwd/permission requests as protocol baseline methods, while `load_session` is the explicit advertised restore capability. Authentication-required is reported only when initialization returns that protocol error; later session authentication remains unverified until the consent/runtime ticket.
- Built-ins resolve direct executables `claude-agent-acp` and `codex-acp`. Custom registrations accept only a canonical absolute native executable path plus the safe valueless switches `--stdio` and `--acp`; package runners, wrappers, arbitrary values, and environment/credential fields are outside the model.
- Public test seams are the serialized Tauri contract, Assistant store actions/selectors, rendered onboarding/status UI, layout controls, registration persistence, and a deterministic fake ACP executable exercised through the Rust discovery boundary.

## Plan

1. RED/GREEN the Rust discovery domain: define one typed built-in/capability registry, direct executable resolution, and an initialize-only ACP probe with actionable compatible/missing/auth-required/incompatible/handshake-failed results. Pin the standalone 2.0 SDK only. A discovery-specific supervisor bounds concurrent probes and protocol frames, enforces a deadline, and terminates plus reaps each child on success, timeout, malformed response, EOF, error, cancellation, and supersession. Fake-agent tests prove cleanup and prove that discovery never sends `session/new`.
2. RED/GREEN versioned custom registration persistence with stable IDs and a monotonic revision. Registrations contain only a verified canonical native executable path and bounded safe transport switches, mutations lock only load/validate/atomic temp-write-and-rename, malformed data surfaces without overwrite, and probes run from an immutable committed snapshot. Thin Tauri commands validate the invoking window’s canonical Workspace identity without transmitting it to the Agent and return the snapshot revision with discovery results. Add one typed frontend platform module for this contract.
3. RED/GREEN a focused Assistant Zustand store and selector hooks. Discovery state is discriminated and keyed by canonical Workspace root, Workspace generation, registration revision, and request token. A focused app-level hook starts discovery only for a ready Workspace, clears state on root/compact transitions, cancels/supersedes obsolete probes, and rejects out-of-order responses. Components render onboarding/discovery status, retry, and canonical-native-executable add/remove controls with a `--stdio` safe-switch option only—no conversation or execution UI.
4. Add the default-visible, independently collapsible/resizable right pane through the shared settings schema. `AppLayout` is the single owner of an aggregate `left + editor minimum + right <= live container width` budget, reclamped during hydration, drag, collapse/expand, and resize; only committed valid widths persist, and pointer cancel/unmount restores browser cursor/select state. `CompactFileLayout` owns a visible explicit action that derives the active file parent and calls `openWorkspaceInNewWindow(parent, activeFile)` so the document is preserved without mounting Assistant state or granting AI consent. Use `Cmd+Shift+\\` to reveal the Assistant when collapsed and focus it when already visible, leaving compact mode unchanged.
5. Update the Assistant spec/ADR-facing documentation only where the implemented discovery contract needs precision, plus keyboard shortcuts if added, changelog, TODO lifecycle, and this worksheet. Do not mark the parent AI-first Assistant feature Done.
6. Run focused tests/typechecking throughout, the repository-required fresh-context implementation reviews, resolve all P0/P1 findings, then run full `vp check`, `vp test`, `cargo test`, `cargo clippy`, `cargo fmt --check`, and `git diff --check`. Commit exactly once for #11 from `11cf263`, staging neither `.gitignore` nor `log/`.

### Risks / edge cases

- A discovery refresh launches each installed registered executable. It must be bounded, terminate/reap every child, never create a session or send a prompt/Workspace cwd, and report failures per agent rather than failing the catalog.
- Slow/out-of-order refreshes must not overwrite newer frontend discovery state.
- Registration files can be missing or malformed; malformed persisted data should surface explicitly instead of silently resetting user data.
- An executable may disappear or change between resolution and spawn; spawn/handshake errors remain actionable status results.
- Pane sizing must not starve the editor or couple Assistant visibility to the existing left navigation pane.

## Plan Review

- Fresh-context Rust/Tauri review: blocked the initial plan because `session/new` crossed consent/scope, child cleanup was unspecified, the proposed SDK versions were incoherent, and persistence was not crash-safe. Revised all four points above.
- Fresh-context Systems Architecture review: independently confirmed the consent and process-lifetime blockers, and required immutable revisioned registration snapshots, an explicit compact action owner, and one aggregate pane-width invariant. Revised above.
- Fresh-context React/Frontend review: required Workspace/generation/request-keyed stale-result handling, compact transition cleanup, and an enforceable shared pane-width budget; also clarified preserved-file behavior and the required reveal/focus shortcut. Revised above.
- Per the user’s bounded-review direction, no duplicate plan reviewers or re-review iteration were started after these concrete findings returned. Implementation proceeds only after resolving every reported P1 in this revised plan.

## Result

- Added a Rust-owned typed registry for Claude Agent ACP and Codex ACP, versioned atomic custom native-executable registrations with bounded safe switches, initialize-only ACP v1 negotiation, actionable status modeling, and per-window supersession. Probes are concurrency-limited, frame/deadline bounded, and terminate/reap direct children plus Unix process groups on success, error, timeout, and cancellation.
- Added the single Assistant Tauri contract, a Workspace-generation/request-keyed Zustand discovery store, focused lifecycle/selectors, and a rendered onboarding catalog with retry, setup guidance, add/remove registration, authentication/missing-capability/handshake states, and no conversation or Agent Turn controls.
- Added the default-visible right Assistant pane, shared three-pane document-width budget, collapse/reveal/focus behavior (`Cmd+Shift+\\`), and a compact-file action that explicitly opens the active file’s containing folder as a new Workspace without mounting Assistant state or granting consent.
- TDD evidence: registry/registration RED→GREEN; deterministic fake ACP compatible/incompatible/auth/malformed/hang paths; supervisor timeout and supersession cleanup; typed IPC; stale Workspace/request responses; rendered status shell; pane budget; compact Workspace action.
- During focused probe testing, the first implementation exposed an unbounded wait for stderr EOF after the protocol and child-reap phases completed. Temporary phase logging isolated it; the stderr drain is now deadline-bounded/cancelled, and the fixture asserts both the Agent and its spawned descendant are gone. Temporary logging was removed.
- Plan review P1s were resolved before implementation. Implementation review and final validation are recorded below when complete.
- The fresh-context internal Spec and Standards implementation reviewers both exceeded the bounded review window and were interrupted on 2026-08-06 at the user's direction. These are recorded as review-tool timeouts, not review passes; the orchestrator's independent two-axis review remains required before staging or commit.

## Local Implementation Review

- Kept discovery lifecycle ownership inside `WorkspaceLayout` rather than `AppLayout`, so compact-file windows neither start nor retain Assistant discovery state; lifecycle cleanup invalidates stale frontend requests on unmount.
- Extended the aggregate pane budget regression to very narrow containers. Preferred-pane drags now shrink the other pane when necessary instead of violating the document reservation.
- Normalized a custom executable at the Rust persistence boundary so validation and later spawning observe the same command.
- Closed the backend Workspace-transition race: discovery advances its epoch while holding the validated root's read lease, and Workspace/standalone transitions invalidate probes only after publishing the new identity.
- Full-suite parallelism showed that cancellation can kill the shell before the fake Agent records a PID. The cleanup assertion now treats an absent PID file as “nothing recorded” while still proving every recorded process and descendant is gone.

## Independent Review Failure — 2026-08-06

The independent Spec and Standards axes failed the first implementation review. No changes may be staged or committed until re-review passes. Required resolutions:

- Harden command-plus-arguments registration against split credential flags, authorization headers, bare credential/token shapes, and equivalent persistence bypasses without adding credential fields.
- Reject package runners and generic dispatcher/interpreter wrappers, including platform-suffixed variants; only a directly registered ACP executable may be launched.
- Add an explicit cancellation IPC owned by Assistant discovery lifecycle cleanup so Workspace close and compact transitions promptly cancel/reap backend probes.
- Make process-group termination, direct-child kill, and reap confirmation an explicit cleanup result; compatibility cannot be reported when cleanup is unconfirmed.
- Exercise registration and every required discovery status/cleanup path through a serialized desktop command boundary with real per-window state and registration storage.
- Where practical in this ticket, fsync the registration parent after rename, use the live layout container width, remove render-phase/effect ownership violations, and centralize the Rust↔TypeScript serialized contract.

## Failed-Review Resolution — 2026-08-06

- P1 credential persistence (superseded by the second review): the first revision added pattern-based rejection for known secret shapes while allowing arbitrary arguments. The second review correctly found that opaque values remained unprovable, so the bounded safe-literal contract below replaces this approach.
- P1 direct executable requirement (superseded by the second review): the first revision rejected named dispatchers and suffix variants but did not structurally require a native file. The canonical regular-native-file contract below replaces basename filtering as the primary guarantee.
- P1 lifecycle cancellation: `cancel_agent_discovery` advances the invoking window's backend discovery epoch. Workspace/compact cleanup clears the frontend projection and invokes that command; window destruction and backend Workspace identity transitions also invalidate the epoch. A serialized Tauri IPC test starts a hanging fake Agent, cancels through the desktop boundary, and proves the process tree is reaped promptly.
- P1 cleanup confirmation: process-group kill, direct-child kill, wait failure, and reap timeout are accumulated into an explicit cleanup result. A compatible initialize response is downgraded to `handshake-failed` whenever cleanup cannot be confirmed; adverse injected cleanup outcomes cover each failure class.
- P1 desktop acceptance: Tauri's mock runtime invokes thin test adapters over the same command cores, real `AppState` window slot, serde models, registration file, discovery supervisor, and executable process boundary. Coverage includes valid registration, rejected credential registration, compatible, missing executable, authentication required, missing restore capability, malformed handshake, supersession, and descendant cleanup.
- P2 durability (superseded by the third review): the first resolution fsynced the parent after rename but reported a post-commit sync failure as a command error. The third review found that this invited duplicate retries; the committed-result semantics below replace that response behavior.
- P2 layout/React ownership: `WorkspaceLayout` measures its live root with `ResizeObserver`, recomputes the shared pane budget during drag and container resize, and uses pointer capture. Render-phase state updates, global pointer listeners, global cursor/select mutation, and component-owned cleanup effects were removed; the editor minimum remains enforced by `resolvePaneWidths`.
- P2 contract ownership: Rust serde models remain the normative wire owner, the TypeScript platform module is explicitly a mirror, and `docs/assistant-discovery-contract.md` records the ownership/update rule. Serialized desktop-boundary tests verify the Rust wire output without introducing a third executable protocol model.

## Second Independent Review Failure — 2026-08-06

The independent Spec and Standards re-review still failed. Staging and commit remain blocked. The revised contract and acceptance work are:

- Replace credential-pattern guessing with a bounded safe-argument contract. Custom registrations accept only a small explicit set of valueless ACP transport switches; opaque positional or value-bearing arguments are rejected. Bound command bytes, argument count, each argument, and aggregate argument bytes with iterative validation.
- Require a custom command to be the already-canonical absolute path of a local regular native executable. Reject symlinks (including non-canonical parent paths), executable text/shebang scripts, non-executable files, missing files, directories, and known native dispatchers. Persist only the verified canonical path and repeat verification immediately before custom spawn; a runtime that disappears remains an actionable missing result.
- Add pathological many-`=` and every over-limit regression at the public registration boundary so validation cannot recurse or scan unbounded input.
- Exercise `remove_agent_registration` through serialized desktop IPC, verifying revision, persisted removal, and absence from subsequent discovery.
- Split Assistant panel Zustand subscriptions to one selector per hook.
- Add one raw shared JSON fixture consumed and round-tripped by Rust serde and reconstructed against the TypeScript wire types so missing, extra, or recased fields fail validation.
- Update UI/spec/contract copy: users configure and authenticate the trusted native runtime outside Writer; Writer stores only its canonical executable path plus safe transport switches and provides no OS sandbox for the runtime's internal behavior.

## Second Failed-Review Resolution — 2026-08-06

- P1 absolute no-secret persistence: RED registration-boundary tests proved an opaque positional secret was accepted. Registration now accepts only the exact valueless literals `--stdio` and `--acp`; it rejects every other positional/value-bearing form before storage. Iterative validation bounds the command to 4096 bytes, arguments to four entries/32 bytes each/64 bytes total, and covers pathological many-`=` input without recursive parsing.
- P1 direct native executable (superseded at spawn by the third review): RED tests covered relative/non-canonical paths, directories, executable shebang text, symlinks, and native dispatchers. Persistence requires an existing canonical absolute regular native executable with executable permissions and an ELF, Mach-O, or PE signature. The third review found the subsequent check-then-path-spawn race; discovery now uses the bound artifact design below.
- P1 remove IPC: a serialized Tauri command test adds then removes a custom registration, verifies the revision increment and persisted empty snapshot, and proves later discovery no longer returns the removed identity.
- P2 selector ownership: Assistant layout access is split into one Zustand selector per focused hook for collapsed state, width, width mutation, and collapse mutation.
- P2 shared wire enforcement: `shared/assistant-discovery-wire.json` is consumed by a strict Rust serde round trip and a TypeScript exact reconstruction, so missing, extra, or recased serialized fields fail validation rather than relying on documentation alone.
- Contract precision: the panel, product spec, and discovery contract explain the conservative safe-switch/native-runtime boundary, external configuration/authentication, revalidation before spawn, and the fact that the trusted user-managed runtime is not sandboxed by Writer.

## Validation

- Focused TDD: the second-review opaque positional value, over-limit/many-`=` inputs, non-canonical/non-native executable, pre-spawn replacement, and serialized removal cases were observed RED before their implementations. The final focused Assistant suite passes 22 Rust tests; the panel/wire/discovery/store frontend group passes 4 files / 6 tests; focused `vp check` passes all 7 relevant files.
- `vp check`: pass, 244 files formatted and 154 files linted/typechecked with no warnings.
- `vp test`: pass, 31 files / 318 tests.
- `cargo test`: pass, 140 tests plus doc tests.
- `cargo clippy`: pass with the same nine pre-existing warnings recorded at baseline and no issue #11 warning.
- `cargo fmt --check`: expected baseline-only `src-tauri/src/lib.rs:257` drift; focused rustfmt passes the issue #11 Rust files and no new formatting drift remains.
- `git diff --check`: pass. Index remains empty; `HEAD` remains `11cf263`. The root `.gitignore` change and `log/` remain untouched and unstaged.
- The first and second independent orchestrator Spec/Standards reviews failed; every second-review P1 and both remaining P2 findings are resolved above. A third independent two-axis re-review is now pending. Do not stage or commit before that gate passes.

## Third Independent Review — 2026-08-06

The third independent Spec axis passed and the Standards axis failed. Staging and commit remain blocked. Required resolutions:

- Close the real check-to-spawn race. A missing custom path must return `missing` without attempting a spawn. An existing custom runtime must be opened and copied into a securely created private executable artifact, the bound artifact must be validated and be the only path spawned, and its lifecycle must cover spawn, protocol, timeout, cancellation, child cleanup, and artifact cleanup. Deterministic discovery seams replace/create the configured source after binding/missing classification and prove the untrusted replacement never executes.
- Bound aggregate registration work with a maximum file size, bounded reads, a maximum registration count enforced on load/add, and a defensive discovery cap. Cover persistence and serialized desktop boundaries.
- Once atomic rename commits a registration snapshot, parent-directory fsync failure must not report mutation failure and invite a duplicate retry. Parent sync remains best-effort because the current IPC snapshot has no durability-diagnostic field.
- Replace saturating revision increments with checked monotonic increments; add/remove overflow must fail without modifying storage.
- Match the Assistant/sidebar shortcut by physical `KeyboardEvent.code === "Backslash"` so `Cmd+Shift+Backslash` works when the shifted key value is `|`.

## Third Failed-Review Resolution — 2026-08-06

- P1 bound executable: deterministic discovery observers run precisely after source binding or missing classification. The RED tests replaced a verified source with an executable script and created a missing script before the old pathname spawn; both scripts executed under the previous flow. Custom discovery now opens the source without following a final symlink on Unix, copies from the opened handle into a securely created private directory, validates that bound native artifact, and spawns only its path. Missing returns without spawn. Success, malformed protocol, timeout, and cancellation tests prove process cleanup and private-artifact removal; an artifact cleanup failure is reported as `handshake-failed`.
- P1 aggregate work: registration reads consume at most 256 KiB plus one sentinel byte, reject files above 256 KiB, and reject more than 32 custom entries before per-entry validation. Add refuses a 33rd entry without modifying storage; discovery defensively rejects an over-limit snapshot and queues only the two built-ins. Persistence and serialized Tauri boundary tests cover oversized files, full/over-limit counts, and unchanged committed bytes.
- P2 commit semantics: parent-directory sync remains attempted after atomic rename, but failure no longer reports the already-visible mutation as failed. A regression proves the committed snapshot is returned/readable, avoiding duplicate retry. The current IPC has no durability-warning field.
- P2 checked revision: add/remove use `checked_add`; `u64::MAX` fails with a revision error and byte-for-byte unchanged storage.
- P2 physical shortcut: the shared Backslash mapper uses `KeyboardEvent.code`, and the focused regression passes `key: "|"` with `code: "Backslash"` for `Cmd+Shift+Backslash` while preserving the unshifted sidebar action.
- Trust boundary: binding freezes the verified bytes selected for a discovery probe and prevents mutable-path substitution. It neither preserves a runtime's adjacent installation resources nor provides an OS sandbox; the user-managed native runtime remains trusted for its internal behavior.

## Third Review Validation

- Focused TDD: the configured-source replacement and missing-to-created races were observed RED, then GREEN with the private bound artifact. Persistence file/count tests, committed-rename semantics, and checked add/remove overflow were observed RED then GREEN. The physical shortcut test was RED for shifted `key: "|"`, then GREEN with `code: "Backslash"`.
- Focused suites: 31 Assistant Rust tests pass; the keyboard/Assistant frontend group passes 5 files / 8 tests; focused `vp check` passes the shortcut implementation and regression.
- `vp check`: pass, 245 files formatted and 155 files linted/typechecked with no warnings. One concurrent-install-style missing `react-dom` link was transient; the declared dependency/link was present and an immediate full rerun passed without source or dependency changes.
- `vp test`: pass, 32 files / 320 tests.
- `cargo test`: pass, 149 tests plus doc tests.
- `cargo clippy`: pass with the same nine pre-existing warnings recorded at baseline and no issue #11 warning.
- `cargo fmt --check`: expected baseline-only `src-tauri/src/lib.rs:257` drift; all issue #11 Rust files were formatted directly and no new drift remains.
- `git diff --check`: pass. Index remains empty; `HEAD` remains `11cf263`. The root `.gitignore` change and `log/` remain untouched and unstaged.
- Third independent review result: Spec PASS, Standards FAIL. All third-review P1/P2 findings are resolved above; a fourth independent two-axis review is pending. Do not stage or commit before that gate passes.

## Fourth Independent Review — 2026-08-06

The fourth independent Spec axis passed and the Standards axis failed. Staging and commit remain blocked. Required resolutions:

- Cap each custom native executable at a documented realistic size using both opened-file metadata and a limit-plus-one streaming sentinel. With three buffered probes, the maximum simultaneous private-copy disk budget must be explicit and bounded.
- Run the complete blocking open/validate/copy/sync/revalidate phase on `spawn_blocking`. Pass the discovery epoch into the copy loop and check it per chunk so Workspace cancellation stops binding promptly; incomplete private artifacts must be removed.
- Cover oversized/sparse input, stream growth beyond the limit, cancellation during copy, concurrency, artifact cleanup, and practical spawn-failure cleanup through deterministic seams.
- Make private-copy compatibility an explicit enforced product contract: a custom native ACP executable must be self-contained and may not require sibling resources/helpers/libraries through `current_exe`, `$ORIGIN`, or `@executable_path`. Built-ins continue normal path launch. A native sibling-dependent fixture must fail with an actionable classification rather than an unexplained handshake error.
- If low-cost, expose post-rename parent-sync failure as a typed optional durability warning without converting committed success to failure. Otherwise document why issue #11 intentionally keeps the existing snapshot-only contract.

Fourth-review resolutions:

- P1 resource bound: registration rejects opened-file metadata above 128 MiB; binding repeats opened-handle metadata validation and copies with a 64 KiB, limit-plus-one sentinel. The entire blocking phase runs in `spawn_blocking`, checks the Workspace discovery epoch before and after every chunk plus before sync/revalidation, and owns its `TempDir` so cancellation and all errors remove partial artifacts. The three-probe buffer makes the aggregate private-copy disk ceiling 384 MiB.
- P1 resource tests: RED/GREEN coverage includes sparse metadata oversize, a source that grows to limit-plus-one during streaming, cancellation immediately after artifact creation with no Ready event or leak, async heartbeat responsiveness, no more than three live custom artifacts, and spawn-failure cleanup.
- P1 compatibility: registration/product copy now requires a self-contained native ACP executable that does not depend on sibling resources/helpers/libraries through `current_exe`, `$ORIGIN`, or `@executable_path`. A compiled sibling-dependent fixture has its resource beside the registered source but not the bound copy; discovery returns `handshake-failed` with the exact actionable constraint. Built-ins retain normal installed-path launch.
- P2 durability warning: deliberately not added in issue #11. The existing serialized command returns the committed snapshot, and a new optional warning would require coordinated Rust wire, shared fixture, TypeScript store, and UI changes without changing the committed outcome. The snapshot-only contract and nonblocking follow-up rationale are explicit in `docs/assistant-discovery-contract.md`.
- Focused RED/GREEN evidence: the oversized registration was initially persisted; limit-plus-one copy wrote the sentinel; binding cancellation reached Ready; the current-thread heartbeat was starved; the sibling-dependent runtime lacked actionable guidance; and panel copy omitted the constraint. Each focused test passed after its boundary fix. The final focused Assistant suite passes 37 Rust tests; the relevant frontend group passes 7 files / 12 tests; focused `vp check` passes both changed frontend files.
- Full validation after fourth-review fixes: `vp check` passes 245 formatted and 155 linted/typechecked files; `vp test` passes 32 files / 320 tests; `cargo test` passes 156 tests plus doc tests; `cargo clippy` passes with the same nine baseline warnings and no issue #11 warning. The first parallel full Rust run exposed the test-only Tauri adapter's shorter two-second discovery deadline after binding moved to the blocking pool; the adapter now uses the real command's five-second bound, its focused desktop test passes, and a fresh full rerun passes.
- `cargo fmt --all -- --check` reports only the known pre-existing `src-tauri/src/lib.rs:257` drift; all issue #11 Rust files are formatted. `git diff --check` passes. The index is empty, `HEAD` remains `11cf263`, and the root `.gitignore` change plus `log/` remain untouched and unstaged.
- Fourth-review fixes are complete and validated. A fifth independent two-axis review is pending; index and commit remain blocked.

## Fifth Independent Review — 2026-08-06

- Spec axis: PASS.
- Standards axis: PASS.
- No blocking P0, P1, or P2 findings remain. The independent dual-axis gate authorizes issue #11 completion and the single implementation commit.
- Optional nonblocking note: spawn-failure cleanup coverage currently removes the bound artifact immediately before spawn and proves the private directory is removed. A future resilience pass may additionally exercise Unix `chmod`/permission-denied spawn failure and platform-equivalent permission assertions; this does not change the accepted artifact-ownership or cleanup contract.
- Final pre-commit verification exposed parallel test-fixture compilation starving shorter positive-test handshake deadlines. The native fake Agent is now compiled once per test process and copied into each isolated fixture directory, while positive classification tests use the production five-second discovery bound. Failure-only diagnostics were removed after diagnosis; a fresh full `cargo test` passes all 156 tests plus doc tests.
- Issue #11 is Done. The parent AI-first ACP Assistant remains Up Next; runtime execution, conversations, and later slices remain outside this ticket.

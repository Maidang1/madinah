# Assistant Discovery IPC Contract

The Rust serde models are the normative owner of Writer's Assistant discovery wire contract. They live under `src-tauri/src/assistant/`; `commands/assistant.rs` is the only Tauri command adapter. `src/platform/tauri/assistant.ts` is the frontend mirror and must not add a second status model or reinterpret fields.

The serialized desktop-boundary tests in `commands/assistant.rs` exercise these Rust models through Tauri IPC before the frontend consumes them. `shared/assistant-discovery-wire.json` is a raw wire fixture consumed by both Rust and TypeScript contract tests: Rust deserializes and exactly reserializes it through the serde owners, while TypeScript reconstructs every typed field and asserts exact raw equality. Until repository code generation is available, changes to a serialized Rust model must update the TypeScript mirror, the shared fixture, and those contract/boundary tests in the same ticket.

## Commands

- `discover_agent_runtimes({ workspaceRoot })` returns `DiscoveryResponse`.
- `cancel_agent_discovery()` returns the new per-window discovery epoch.
- `add_agent_registration({ workspaceRoot, command, args })` returns `RegistrationSnapshot`.
- `remove_agent_registration({ workspaceRoot, id })` returns `RegistrationSnapshot`.

Registration input and storage contain only a directly launched native executable plus a conservative set of valueless ACP transport switches. The Rust boundary enforces all of the following before persistence:

- The command is at most 4096 bytes and is the explicit canonical absolute path of an existing local regular native executable file.
- The path is not a symlink or a spelling containing aliases, `.`/`..`, or symlinked parents; the file is executable on Unix and has a native ELF, Mach-O, or PE signature.
- Scripts, shebang/text wrappers, package runners, shells, interpreters, and generic dispatchers are rejected. Discovery binds and revalidates a private copy from an opened source handle as described below; a runtime missing at classification remains an actionable `missing` result and is never spawned by pathname.
- A custom native executable is limited to 128 MiB. Registration checks file metadata, while discovery repeats that check on the safely opened handle and uses a limit-plus-one streaming sentinel so sparse files or files that grow after inspection cannot exceed the private-copy bound.
- Arguments are limited to at most four exact literals drawn from `--stdio` and `--acp`, with at most 32 bytes per argument and 64 bytes total. All opaque positional, `=`-bearing, and other value-bearing arguments are rejected rather than inspected with credential heuristics.
- The complete registration file is read through a 256 KiB bound and contains at most 32 custom registrations. Adds at the count limit fail before persistence, discovery rejects an over-limit in-memory snapshot without queueing custom probes, and revision increments use checked arithmetic so overflow cannot overwrite the committed file.

Configure models, profiles, environment, and authentication in the direct runtime outside Writer. Writer persists no runtime values or credentials. The user-managed native runtime is trusted for its own internal behavior, consistent with the product's no-sandbox contract; native-file checks do not make the runtime safe or confine it after launch.

## Bound custom executable lifecycle

Custom discovery never passes the mutable registered pathname to `Command::spawn`. If the configured path is missing, discovery returns `missing` immediately and does not retry or spawn a file created after that classification. Otherwise Writer opens the canonical source without following a final symlink on Unix, validates the opened regular/executable/native file, and copies from that exact handle into a securely created private temporary directory. The copied artifact is validated again and is the only path launched. The complete open/validate/copy/sync/revalidate phase runs on the blocking pool; every 64 KiB copy chunk checks the per-window discovery epoch so Workspace close or supersession stops binding and drops the incomplete temporary directory promptly.

At most three probes, and therefore three private bindings, are buffered concurrently. With the 128 MiB per-executable ceiling, custom discovery has a hard 384 MiB aggregate private-copy disk bound.

The bound artifact owner remains alive across spawn, initialize, timeout, cancellation, process-group/direct-child termination, reap confirmation, and stderr drain. After the probe result is known, Writer explicitly closes the private directory; inability to confirm artifact cleanup downgrades the result to `handshake-failed`. This closes configured-path replacement races, but it does not sandbox or audit the bound native runtime. The user-managed runtime remains trusted for everything it does after launch.

Because custom runtimes execute from that isolated copy, the registration contract requires a self-contained native ACP executable. It must not locate sibling resources, helpers, or libraries through `current_exe`, `$ORIGIN`, or `@executable_path`. Writer classifies a resulting startup/handshake failure with this actionable constraint. Built-in Agents continue to launch normally from their installed path and are not subject to the private-copy compatibility constraint.

## Registration commit semantics

Registration changes write and sync a private temporary file, atomically rename it into place, and then attempt to sync the parent directory. Before rename, any failure returns an error and leaves the previous snapshot authoritative. After rename, the mutation is committed and the command returns the committed snapshot even if the best-effort parent sync fails; reporting a mutation failure at that point would invite a duplicate retry. Issue #11 intentionally keeps the existing snapshot-only IPC contract: adding a typed durability warning would change the shared Rust/TypeScript wire model, store, and UI for a diagnostic that cannot change the already-committed outcome. That optional diagnostic remains nonblocking follow-up work rather than expanding discovery scope.

## Discovery status

Rust serializes `AgentStatus` as `compatible`, `missing`, `authentication-required`, `incompatible`, or `handshake-failed`. A discovery entry also includes its stable identity, source, direct command and arguments, setup URL, required capability profile, message, missing capabilities, optional Agent information, and advertised authentication methods.

`DiscoveryResponse.workspaceRoot` is the canonical Workspace root validated against the invoking window. `registrationRevision` identifies the immutable registration snapshot used for that discovery. A malformed registration file is reported through `registrationError` without overwriting the file or suppressing built-in Agent results.

Discovery is initialize-only. It does not create or restore a session, send a prompt, transmit the Workspace path to an Agent, or start issue #12 runtime execution.

# Worksheet: Madinah Cloudflare Image Upload

## TODO

- In Progress: Madinah Cloudflare image upload migration: [`SPECs/madinah-cloudflare-image-upload-spec.md`](../madinah-cloudflare-image-upload-spec.md)

## Reviewed

- `TODOS.md`
- `docs/workflows/agent-loop.md`
- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src-tauri/src/commands/images.rs`
- `apps/desktop/src-tauri/src/commands/settings.rs`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src-tauri/Cargo.toml`
- `apps/desktop/tests/image-paste.test.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/domain/assets.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/assets/image-upload.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/electron/main/backend.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/platform/ports.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/settings/WriterSettingsDialog.tsx`
- `/Users/bytedance/codes/myself/madinah/apps/writer-upload-worker/README.md`
- `/Users/bytedance/codes/myself/madinah/apps/writer-upload-worker/src/index.ts`

## Baseline

- `vp check`: exit 0 with existing warnings in `apps/desktop/e2e/wdio.conf.js` and `apps/desktop/e2e/specs/smoke.spec.js`.
- `vp test`: passed, 30 files and 475 tests.
- `cargo test`: passed, 118 tests.
- `cargo clippy`: exit 0 with existing Rust warnings.
- `cargo fmt --check`: passed.

Commands used `PATH=/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH` for Vite+ because the shell has no global `node` or `vp`.

## Findings

- The current fork saves pasted images locally through `save_clipboard_image` and inserts a relative `{stem}-assets/...` Markdown destination.
- The old Madinah writer now uses a provider-shaped upload settings model with `endpoint`, `apiKey`, `publicBaseUrl`, `prefix`, and `maxBytes`.
- The current Madinah upload service contract is `GET /health` and `PUT /:key` with `x-api-key`.
- API key storage should stay outside the generic schema-driven settings store because that store is exposed to all settings UI and theme side effects.
- Keeping local save as a fallback makes the editor useful before upload settings are configured.

## Plan

1. Add a Rust `asset_upload` command module for settings normalization, masked persistence, worker health check, key generation, and image upload.
2. Add TypeScript types and Tauri wrappers for the new commands.
3. Add a small asset upload settings section to Preferences.
4. Update image paste handling to attempt remote upload first, then fall back to local save when settings are incomplete.
5. Add frontend and Rust tests for the new contract.

## Risks

- Adding an HTTP client increases the desktop dependency surface. Use a narrow `reqwest` feature set.
- Remote upload failures during paste should be visible in logs while preserving local fallback only for configuration absence.
- The first implementation should avoid embedding provider-specific Cloudflare credentials in frontend state beyond the user-filled form.

## Implementation

- Added `apps/desktop/src-tauri/src/commands/asset_upload.rs` with provider-shaped settings, masked API key persistence in `asset-upload.json`, Worker health check, image upload, public URL construction, and object keys shaped as `{prefix}/{yyyy}/{mm}/{sha256-12}-{safe-file-stem}.{ext}`.
- Registered `load_asset_upload_settings`, `save_asset_upload_settings`, `check_asset_upload_settings`, and `upload_asset_image` in Tauri.
- Added typed frontend wrappers in `apps/desktop/src/lib/tauri.ts` and upload helpers in `apps/desktop/src/lib/asset-upload.ts`.
- Extracted pasted-image resolution to `apps/desktop/src/components/editor-area/image-paste-handler.ts`, so remote upload and local fallback are testable outside CodeMirror.
- Added `AssetUploadSection` to Preferences with explicit Save and Check actions.
- Added Rust tests for settings normalization, secret masking, validation, URL formatting, and key generation.
- Added frontend tests for upload helper behavior, IPC shape, remote paste upload, and local fallback.

## Review

- Manual implementation review completed for secret storage boundary, fallback behavior, and Worker URL/key construction.
- Multi-agent review was not spawned because the available sub-agent tool requires explicit user authorization for delegation.

## Results

- `vp check`: exit 0 with the existing e2e JS warnings noted in Baseline.
- `vp test`: passed, 31 files and 484 tests.
- `vp run desktop#build`: passed.
- `cargo test`: passed, 125 tests.
- `cargo clippy`: exit 0 with the existing Rust warnings noted in Baseline.
- `cargo fmt --check`: passed.

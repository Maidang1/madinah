# Madinah Cloudflare Image Upload

## Goal

Make pasted images in the desktop editor publish through the Madinah asset upload service and insert the public asset URL into Markdown.

Reference implementation:

- Old writer asset domain: `/Users/bytedance/codes/myself/madinah/apps/writer/src/domain/assets.ts`
- Old writer upload handler: `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/assets/image-upload.ts`
- Old writer desktop backend: `/Users/bytedance/codes/myself/madinah/apps/writer/electron/main/backend.ts`
- Upload worker: `/Users/bytedance/codes/myself/madinah/apps/writer-upload-worker`

## Scope

This slice owns the desktop upload path inside the current Tauri fork:

- Add a provider-shaped asset upload settings model for the Madinah Cloudflare R2 Worker.
- Store upload settings in the app data directory with the API key masked on read.
- Add Tauri IPC commands to load, save, check, and upload images.
- Make pasted images use the remote upload path when settings are complete.
- Keep local image saving as the fallback path while settings are incomplete.
- Add a Preferences section for endpoint, API key, public base URL, prefix, max size, and connection check.

## Out Of Scope

- Deploying or changing the Cloudflare Worker.
- Migrating AI polish.
- Reintroducing slash commands.
- Rewriting image preview rendering.

## Constraints

- Keep Cloudflare provider details behind an upload-provider boundary so the editor can later target other providers.
- Keep API keys out of the generic schema-driven settings store.
- Use the upload worker contract: `GET /health` and `PUT /:key` with `x-api-key`.
- Insert the public URL returned by the backend into Markdown.
- Preserve the existing local `{stem}-assets` path as a fallback.

## Acceptance

- Preferences can load, save, mask, and check asset upload settings.
- Pasting a supported image with complete settings uploads through the Worker and inserts `![name](https://...)`.
- Pasting with incomplete settings still saves locally and inserts the relative path.
- The backend rejects unsupported image types, empty payloads, oversized payloads, invalid URLs, and traversal prefixes.
- Tests cover settings normalization, key generation, IPC shape, and paste handler behavior.

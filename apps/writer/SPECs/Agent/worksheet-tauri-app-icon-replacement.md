# Worksheet: Tauri App Icon Replacement

## Task

- TODO: `Tauri app icon replacement`
- Spec: [`SPECs/tauri-app-icon-replacement-spec.md`](../tauri-app-icon-replacement-spec.md)

## Starting State

- Worktree already had unrelated dependency compatibility changes in `CHANGELOG.md`, `TODOS.md`, `apps/desktop/package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`.
- Tauri icon paths are defined in `apps/desktop/src-tauri/tauri.conf.json`.
- Existing icon assets live under `apps/desktop/src-tauri/icons/`.

## Reviewed

- `TODOS.md`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/icons/`
- Provided image: 1024x1536 PNG

## Plan

1. Crop the provided portrait image into a 1024x1024 square source.
2. Save the square source as `apps/desktop/src-tauri/icons/icon-source.png`.
3. Run the Tauri CLI icon generator against the square source.
4. Verify generated dimensions and diff cleanliness.
5. Update task and changelog artifacts.

## Implementation

- Cropped the source image to a 1024x1024 square, preserving the hat, face, heart, and ice cream.
- Generated the full Tauri icon set with `corepack pnpm --dir apps/desktop tauri icon /tmp/writer-icon-preview/icon-source.png`.
- Kept `tauri.conf.json` unchanged because its configured icon paths already point at the generated files.

## Validation

- `sips -g pixelWidth -g pixelHeight apps/desktop/src-tauri/icons/icon-source.png apps/desktop/src-tauri/icons/icon.png apps/desktop/src-tauri/icons/128x128.png apps/desktop/src-tauri/icons/32x32.png`
  - Confirmed 1024x1024 source, 512x512 `icon.png`, 128x128, and 32x32 outputs.
- `corepack pnpm exec vp check`
  - Passed with one existing warning in `apps/desktop/src/lib/frontmatter-schema.ts`.
- `git diff --check`
  - Passed.
- `corepack pnpm exec vp test`
  - Passed: 36 files, 535 tests.

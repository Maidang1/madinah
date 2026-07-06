# Tauri App Icon Replacement

## Goal

Use the provided illustrated character image as the Writer Tauri app icon.

## Scope

- Crop the provided 1024x1536 PNG into a square source icon.
- Store the square source at `apps/desktop/src-tauri/icons/icon-source.png`.
- Regenerate the Tauri icon set from the square source with the Tauri CLI.
- Keep `apps/desktop/src-tauri/tauri.conf.json` icon paths unchanged.

## Out Of Scope

- Product rename or bundle identifier changes.
- Release signing or notarization.
- Runtime UI branding changes outside app icons.

## Acceptance

- `icon-source.png` is 1024x1024.
- Tauri-generated desktop icons exist at the configured paths: `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, and `icon.ico`.
- Existing tracked Windows, iOS, and Android icon assets are regenerated from the same source image.
- `git diff --check` passes.

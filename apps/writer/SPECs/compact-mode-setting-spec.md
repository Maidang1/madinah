# Compact Mode Setting

## Goal

Make compact mode a normal user setting, similar to theme mode, so it can be toggled from the command palette and persisted across launches.

## Behavior

- Add an `appearance.compact-mode` boolean setting, default `false`.
- When enabled and a workspace is open, the app uses compact chrome: no sidebar, no sidebar toggle, no tab strip, and the centered top file picker remains available.
- Explicit single-file opens can still request compact chrome, preserving the existing direct-file workflow.
- Turning compact mode off from the command palette restores workspace chrome even if the current window entered compact chrome through an explicit file open.
- Remove the debug-only compact launch environment variable path from Rust startup and docs.

## Implementation Notes

- Keep raw workspace `chromeMode` for startup/open-flow semantics.
- Resolve an effective chrome mode in frontend hooks from `chromeMode` plus `appearance.compact-mode`.
- Do not let the setting make session-save logic skip normal workspace sessions; only raw explicit compact opens should keep bypassing session writes.

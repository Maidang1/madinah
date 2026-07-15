# Keyboard Shortcuts

Canonical shortcut reference for Writer.

## Global

These shortcuts are handled by the global `useKeyboardShortcuts` hook and work regardless of editor focus.

| Shortcut        | Action                        |
| --------------- | ----------------------------- |
| Cmd+P           | File search (command palette) |
| Cmd+O           | Go to file                    |
| Cmd+N           | Create new note               |
| Cmd+T           | New tab                       |
| Cmd+W           | Close current tab             |
| Cmd+\\          | Toggle sidebar                |
| Ctrl+Tab        | Next tab                      |
| Ctrl+Shift+Tab  | Previous tab                  |
| Cmd+1 ... Cmd+9 | Jump to Nth tab               |
| Alt+ArrowLeft   | Navigate back                 |
| Alt+ArrowRight  | Navigate forward              |

In compact single-file windows, sidebar and tab-management shortcuts do not
create hidden UI state: Cmd+\\, Cmd+T, Ctrl+Tab, Ctrl+Shift+Tab, and Cmd+1 ...
Cmd+9 are ignored. Cmd+P, Cmd+O, Cmd+N, and history navigation still work.

## Menu Accelerators

These shortcuts are bound to the native app menu (Tauri menu accelerators) rather than the global JS handler.

| Shortcut | Action                                                |
| -------- | ----------------------------------------------------- |
| Cmd+,    | Open Preferences (Settings tab) in the focused window |

## Editor

Standard editing shortcuts provided by TipTap/ProseMirror apply while the editor is focused.

| Shortcut    | Action     |
| ----------- | ---------- |
| Cmd+B       | Bold       |
| Cmd+I       | Italic     |
| Cmd+Z       | Undo       |
| Cmd+Shift+Z | Redo       |
| Cmd+A       | Select all |

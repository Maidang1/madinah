export const WRITER_COMMAND_EVENT = "writer-command";

export const NATIVE_MENU_COMMAND_IDS = [
  "document.new",
  "document.open",
  "document.revert",
  "document.close",
  "editor.format.bold",
  "editor.format.italic",
  "editor.format.link",
  "document.search",
  "view.commandPalette",
  "view.quickOpen",
  "view.toggleSidebar",
  "view.toggleInspector",
  "view.focusMode",
  "view.typewriterMode",
  "view.write",
  "view.preview",
  "view.source",
  "go.outline",
  "inspector.showOutline",
  "inspector.showProperties",
  "inspector.showStats",
  "inspector.showHistory",
] as const;

export function getWriterCommandIdFromPayload(payload: unknown): string | null {
  return typeof payload === "string" && payload.length > 0 ? payload : null;
}

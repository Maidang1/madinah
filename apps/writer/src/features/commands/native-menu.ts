export const WRITER_COMMAND_EVENT = "writer-command";

export const NATIVE_MENU_COMMAND_IDS = [
  "document.new",
  "document.open",
  "document.save",
  "document.saveAs",
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
  "go.outline",
] as const;

export function getWriterCommandIdFromPayload(payload: unknown): string | null {
  return typeof payload === "string" && payload.length > 0 ? payload : null;
}

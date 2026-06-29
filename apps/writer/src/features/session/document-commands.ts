import type { WriterCommand } from "../../domain/engine";

export interface DocumentCommandHandlers {
  newDocument: () => void | Promise<void>;
  open: () => void | Promise<void>;
  save: () => void | Promise<void>;
  saveAs: () => void | Promise<void>;
  revert: () => void | Promise<void>;
  close: () => void | Promise<void>;
}

export function createDocumentCommands(
  handlers: DocumentCommandHandlers,
): WriterCommand[] {
  return [
    {
      id: "document.new",
      label: "New Document",
      group: "File",
      shortcut: "⌘N",
      scope: "file",
      priority: 90,
      run: handlers.newDocument,
    },
    {
      id: "document.open",
      label: "Open",
      group: "File",
      shortcut: "⌘O",
      scope: "file",
      priority: 95,
      run: handlers.open,
    },
    {
      id: "document.save",
      label: "Save",
      group: "File",
      shortcut: "⌘S",
      scope: "file",
      priority: 120,
      run: handlers.save,
    },
    {
      id: "document.saveAs",
      label: "Save As",
      group: "File",
      shortcut: "⇧⌘S",
      scope: "file",
      priority: 80,
      run: handlers.saveAs,
    },
    {
      id: "document.revert",
      label: "Revert",
      group: "File",
      scope: "file",
      priority: 30,
      run: handlers.revert,
    },
    {
      id: "document.close",
      label: "Close",
      group: "File",
      shortcut: "⌘W",
      scope: "file",
      priority: 20,
      run: handlers.close,
    },
  ];
}

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
      run: handlers.newDocument,
    },
    {
      id: "document.open",
      label: "Open",
      run: handlers.open,
    },
    {
      id: "document.save",
      label: "Save",
      run: handlers.save,
    },
    {
      id: "document.saveAs",
      label: "Save As",
      run: handlers.saveAs,
    },
    {
      id: "document.revert",
      label: "Revert",
      run: handlers.revert,
    },
    {
      id: "document.close",
      label: "Close",
      run: handlers.close,
    },
  ];
}

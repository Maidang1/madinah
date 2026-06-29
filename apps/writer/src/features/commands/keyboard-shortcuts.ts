export type WriterKeyboardShortcutAction =
  | {
      kind: "none";
    }
  | {
      kind: "command";
      commandId: string;
    }
  | {
      kind: "quick-open";
    }
  | {
      kind: "command-palette";
    }
  | {
      kind: "document-search";
    };

export interface WriterKeyboardShortcutEvent {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

const ALT_COMMANDS: Record<string, string> = {
  s: "view.toggleSidebar",
  i: "view.toggleInspector",
  f: "view.focusMode",
  t: "view.typewriterMode",
  o: "go.outline",
  "1": "editor.format.heading1",
  "2": "editor.format.heading2",
  "3": "editor.format.heading3",
};

const COMMANDS: Record<string, string> = {
  n: "document.new",
  o: "document.open",
  b: "editor.format.bold",
  i: "editor.format.italic",
  k: "editor.format.link",
  w: "document.close",
};

export function getWriterKeyboardShortcutAction(
  event: WriterKeyboardShortcutEvent,
): WriterKeyboardShortcutAction {
  if (!event.metaKey && !event.ctrlKey) return { kind: "none" };

  const key = event.key.toLowerCase();

  if (event.altKey) {
    const commandId = ALT_COMMANDS[key];
    if (commandId) return { kind: "command", commandId };
  }

  if (key === "p" && event.shiftKey) return { kind: "command-palette" };
  if (key === "p") return { kind: "quick-open" };
  if (key === "f") return { kind: "document-search" };
  if (key === "s") {
    return {
      kind: "command",
      commandId: event.shiftKey ? "document.saveAs" : "document.save",
    };
  }

  const commandId = COMMANDS[key];
  return commandId ? { kind: "command", commandId } : { kind: "none" };
}

import type { Editor } from "@tiptap/react";
import type { EditorState } from "@tiptap/pm/state";
import { getEditorCommandsForSurface } from "./editor-commands";
import {
  createSlashCommandItems,
  groupSlashCommandItems,
  matchSlashCommandTriggerText,
  type SlashCommandItem,
} from "./slash-commands";

export interface TiptapSlashTrigger {
  from: number;
  to: number;
  query: string;
}

interface CommandRange {
  from: number;
  to: number;
}

const TIPTAP_BLOCK_COMMAND_IDS = new Set([
  "format.paragraph",
  "format.heading1",
  "format.heading2",
  "format.heading3",
  "format.heading4",
  "format.heading5",
  "format.heading6",
  "format.bulletList",
  "format.numberedList",
  "format.taskList",
  "format.blockquote",
  "toggleFencedCodeBlock",
  "insertHorizontalRule",
]);

export function getTiptapSlashCommandItems(): SlashCommandItem[] {
  const supported = createSlashCommandItems(getEditorCommandsForSurface("slash")).filter((item) =>
    TIPTAP_BLOCK_COMMAND_IDS.has(item.id),
  );
  return groupSlashCommandItems(supported).flatMap((group) => group.items);
}

export function getTiptapSlashTrigger(state: EditorState): TiptapSlashTrigger | null {
  const selection = state.selection;
  if (!selection.empty || !selection.$from.parent.isTextblock) return null;

  const textBeforeCaret = selection.$from.parent.textBetween(
    0,
    selection.$from.parentOffset,
    "\0",
    "\0",
  );
  const match = matchSlashCommandTriggerText(textBeforeCaret);
  if (!match) return null;

  return {
    from: selection.from - (textBeforeCaret.length - match.slashOffset),
    to: selection.from,
    query: match.query,
  };
}

export function runTiptapSlashCommand(
  editor: Editor,
  commandId: string,
  range: CommandRange,
): boolean {
  const chain = editor.chain().focus().deleteRange(range);

  switch (commandId) {
    case "format.paragraph":
      return chain.setParagraph().run();
    case "format.heading1":
      return chain.setHeading({ level: 1 }).run();
    case "format.heading2":
      return chain.setHeading({ level: 2 }).run();
    case "format.heading3":
      return chain.setHeading({ level: 3 }).run();
    case "format.heading4":
      return chain.setHeading({ level: 4 }).run();
    case "format.heading5":
      return chain.setHeading({ level: 5 }).run();
    case "format.heading6":
      return chain.setHeading({ level: 6 }).run();
    case "format.bulletList":
      return chain.toggleBulletList().run();
    case "format.numberedList":
      return chain.toggleOrderedList().run();
    case "format.taskList":
      return chain.toggleTaskList().run();
    case "format.blockquote":
      return chain.toggleBlockquote().run();
    case "toggleFencedCodeBlock":
      return chain.toggleCodeBlock().run();
    case "insertHorizontalRule":
      return chain.setHorizontalRule().run();
    default:
      return false;
  }
}

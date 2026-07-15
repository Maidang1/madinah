import type { Editor } from "@tiptap/react";
import type { EditorState } from "@tiptap/pm/state";
import {
  createSlashCommandItems,
  groupSlashCommandItems,
  matchSlashCommandTriggerText,
  type SlashCommandDescriptor,
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

const TIPTAP_SLASH_COMMANDS: SlashCommandDescriptor[] = [
  blockCommand("format.paragraph", "Paragraph", "Write a plain text block", "T", 100, ["text"]),
  blockCommand("format.heading1", "Heading 1", "Large section heading", "H₁", 99, ["title"]),
  blockCommand("format.heading2", "Heading 2", "Medium section heading", "H₂", 98, ["subtitle"]),
  blockCommand("format.heading3", "Heading 3", "Small section heading", "H₃", 97, []),
  blockCommand("format.heading4", "Heading 4", "Fourth-level section heading", "H₄", 96, []),
  blockCommand("format.heading5", "Heading 5", "Fifth-level section heading", "H₅", 95, []),
  blockCommand("format.heading6", "Heading 6", "Sixth-level section heading", "H₆", 94, []),
  blockCommand("format.bulletList", "Bullet list", "Start a bulleted list", "•", 93, ["unordered"]),
  blockCommand("format.numberedList", "Numbered list", "Start a numbered list", "1.", 92, [
    "ordered",
  ]),
  blockCommand("format.taskList", "Task list", "Track an item with a checkbox", "☑", 91, ["todo"]),
  blockCommand(
    "format.blockquote",
    "Blockquote",
    "Capture a quote or highlighted passage",
    "❞",
    90,
    ["quote"],
  ),
  blockCommand("toggleFencedCodeBlock", "Code block", "Insert or toggle a code block", "{}", 89, [
    "code",
    "fence",
  ]),
  {
    id: "insertHorizontalRule",
    label: "Divider",
    group: "Insert",
    section: "Media & inserts",
    description: "Insert a horizontal rule",
    icon: "—",
    keywords: ["divider", "rule", "hr"],
    priority: 88,
  },
];

function blockCommand(
  id: string,
  label: string,
  description: string,
  icon: string,
  priority: number,
  keywords: string[],
): SlashCommandDescriptor {
  return {
    id,
    label,
    group: id.includes("List") ? "Lists" : "Paragraph",
    section: "Basic blocks",
    description,
    icon,
    keywords: [label, id, ...keywords],
    priority,
  };
}

export function getTiptapSlashCommandItems(): SlashCommandItem[] {
  return groupSlashCommandItems(createSlashCommandItems(TIPTAP_SLASH_COMMANDS)).flatMap(
    (group) => group.items,
  );
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

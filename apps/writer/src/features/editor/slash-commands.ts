import type { WriterCommand } from "../../domain/engine";

export interface SlashCommandItem {
  id: string;
  label: string;
  group: string;
  keywords: string[];
  shortcut: string;
  priority: number;
  command: WriterCommand;
  order: number;
}

export interface SlashCommandPosition {
  x: number;
  y: number;
}

export interface SlashCommandTriggerMatch {
  query: string;
  slashOffset: number;
}

export interface SlashCommandReplacement {
  start: number;
  end: number;
}

interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

interface Size {
  width: number;
  height: number;
}

const INLINE_SLASH_COMMAND_IDS = new Set([
  "editor.format.bold",
  "editor.format.italic",
  "editor.format.link",
  "editor.format.inlineCode",
]);

const SLASH_PRIORITY_BY_ID: Record<string, number> = {
  "editor.insert.paragraph": 100,
  "editor.insert.h1": 98,
  "editor.insert.h2": 97,
  "editor.insert.h3": 96,
  "editor.insert.bullet": 94,
  "editor.insert.number": 93,
  "editor.insert.checklist": 92,
  "editor.insert.quote": 90,
  "editor.insert.code": 88,
  "editor.insert.table": 86,
  "editor.insert.divider": 84,
  "editor.format.bold": 50,
  "editor.format.italic": 49,
  "editor.format.link": 48,
  "editor.format.inlineCode": 47,
};

export function createSlashCommandItems(
  commands: WriterCommand[],
): SlashCommandItem[] {
  const items: SlashCommandItem[] = [];
  const seen = new Set<string>();

  for (const command of commands) {
    if (!isSlashCommand(command) || seen.has(command.id)) continue;

    seen.add(command.id);
    items.push({
      id: command.id,
      label: command.label,
      group: getSlashCommandGroup(command),
      keywords: command.keywords ?? [],
      shortcut: command.shortcut ?? "",
      priority: getSlashCommandPriority(command),
      command,
      order: items.length,
    });
  }

  return items.sort(compareSlashCommandItems);
}

export function searchSlashCommandItems(
  items: SlashCommandItem[],
  query: string,
): SlashCommandItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...items].sort(compareSlashCommandItems);

  return items
    .map((item) => ({
      item,
      score: getSlashCommandScore(item, normalized),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => {
      return (
        left.score - right.score ||
        compareSlashCommandItems(left.item, right.item)
      );
    })
    .map((entry) => entry.item);
}

export function matchSlashCommandTriggerText(
  textBeforeCaret: string,
): SlashCommandTriggerMatch | null {
  const match = textBeforeCaret.match(/^[\s\u200b]*\/([^\s/]*)$/u);
  if (!match) return null;

  return {
    query: match[1] ?? "",
    slashOffset: textBeforeCaret.lastIndexOf("/"),
  };
}

export function getSlashCommandPosition(
  caret: RectLike,
  menu: Size,
  viewport: Size,
): SlashCommandPosition {
  const padding = 8;
  const gap = 8;
  const maxX = Math.max(padding, viewport.width - menu.width - padding);
  const maxY = Math.max(padding, viewport.height - menu.height - padding);
  const preferredY = caret.bottom + gap;
  const fallbackY = caret.top - menu.height - gap;

  return {
    x: Math.min(Math.max(caret.left, padding), maxX),
    y: Math.min(
      Math.max(preferredY + menu.height > viewport.height ? fallbackY : preferredY, padding),
      maxY,
    ),
  };
}

export function replaceSlashTriggerInMarkdown(
  markdown: string,
  triggerText: string,
  insertionMarkdown: string,
): string {
  const replacement = findSlashTriggerReplacement(markdown, triggerText);
  if (!replacement) return `${markdown}${insertionMarkdown}`;

  return `${markdown.slice(0, replacement.start)}${insertionMarkdown}${markdown.slice(
    replacement.end,
  )}`;
}

function isSlashCommand(command: WriterCommand): boolean {
  return (
    command.id.startsWith("editor.insert.") ||
    INLINE_SLASH_COMMAND_IDS.has(command.id) ||
    (command.scope === "insert" && !command.id.startsWith("editor.format."))
  );
}

function getSlashCommandGroup(command: WriterCommand): string {
  if (command.id.startsWith("editor.insert.")) {
    const templateGroup = command.keywords?.[0]?.trim();
    return templateGroup && templateGroup !== "Insert" ? templateGroup : "Insert";
  }

  return command.group ?? "Format";
}

function getSlashCommandPriority(command: WriterCommand): number {
  return SLASH_PRIORITY_BY_ID[command.id] ?? (command.scope === "insert" ? 40 : 20);
}

function compareSlashCommandItems(
  left: SlashCommandItem,
  right: SlashCommandItem,
): number {
  return right.priority - left.priority || left.order - right.order;
}

function getSlashCommandScore(item: SlashCommandItem, query: string): number {
  const label = item.label.toLowerCase();
  const id = item.id.toLowerCase();
  const group = item.group.toLowerCase();
  const keywords = item.keywords.map((keyword) => keyword.toLowerCase());

  if (label.includes(query)) return label.startsWith(query) ? 0 : 1;
  if (group.includes(query)) return 2;
  if (keywords.some((keyword) => keyword.includes(query))) return 3;
  if (id.includes(query)) return 4;
  return -1;
}

function findSlashTriggerReplacement(
  markdown: string,
  triggerText: string,
): SlashCommandReplacement | null {
  const candidates = [...new Set([triggerText, triggerText.trimStart(), "/"])].filter(
    Boolean,
  );

  for (const candidate of candidates) {
    let searchFrom = markdown.length;

    while (searchFrom >= 0) {
      const index = markdown.lastIndexOf(candidate, searchFrom);
      if (index < 0) break;

      const lineStart = markdown.lastIndexOf("\n", index - 1) + 1;
      const linePrefix = markdown.slice(lineStart, index);
      const end = index + candidate.length;
      const nextChar = markdown[end];

      if (
        /^[\s\u200b]*$/u.test(linePrefix) &&
        (nextChar === undefined || nextChar === "\n" || nextChar === "\r")
      ) {
        return {
          start: lineStart,
          end,
        };
      }

      searchFrom = index - 1;
    }
  }

  return null;
}

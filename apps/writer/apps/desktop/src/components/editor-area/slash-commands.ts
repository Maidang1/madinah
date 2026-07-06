import type { EditorCommand } from "./editor-commands";

export interface SlashCommandItem {
  id: string;
  label: string;
  group: string;
  keywords: string[];
  shortcut: string;
  priority: number;
  command: EditorCommand;
  order: number;
}

export interface SlashCommandTriggerMatch {
  query: string;
  slashOffset: number;
  atLineStart: boolean;
}

export interface SlashCommandPosition {
  x: number;
  y: number;
}

interface RectLike {
  left: number;
  top: number;
  bottom: number;
}

interface Size {
  width: number;
  height: number;
}

export function createSlashCommandItems(commands: EditorCommand[]): SlashCommandItem[] {
  const seen = new Set<string>();
  const items: SlashCommandItem[] = [];

  for (const command of commands) {
    if (!command.surfaces.includes("slash") || seen.has(command.id)) continue;
    seen.add(command.id);
    items.push({
      id: command.id,
      label: command.label,
      group: command.group,
      keywords: command.keywords,
      shortcut: command.shortcut ?? "",
      priority: command.priority,
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
    .sort(
      (left, right) => left.score - right.score || compareSlashCommandItems(left.item, right.item),
    )
    .map((entry) => entry.item);
}

export function matchSlashCommandTriggerText(
  textBeforeCaret: string,
): SlashCommandTriggerMatch | null {
  const match = textBeforeCaret.match(/(^|[\s\u200b])\/([^\s/]*)$/u);
  if (!match) return null;

  const slashOffset = textBeforeCaret.lastIndexOf("/");
  const linePrefix = textBeforeCaret.slice(
    textBeforeCaret.lastIndexOf("\n", slashOffset - 1) + 1,
    slashOffset,
  );

  return {
    query: match[2] ?? "",
    slashOffset,
    atLineStart: /^[\s\u200b]*$/u.test(linePrefix),
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

function compareSlashCommandItems(left: SlashCommandItem, right: SlashCommandItem): number {
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

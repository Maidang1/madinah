export type SlashCommandSection = "Basic blocks" | "Media & inserts";

export interface SlashCommandDescriptor {
  id: string;
  label: string;
  group: string;
  section: SlashCommandSection;
  description: string;
  icon: string;
  keywords: string[];
  shortcut?: string;
  priority: number;
}

export interface SlashCommandItem {
  id: string;
  label: string;
  group: string;
  section: SlashCommandSection;
  description: string;
  icon: string;
  keywords: string[];
  shortcut: string;
  priority: number;
  order: number;
}

export interface SlashCommandGroup {
  section: SlashCommandSection;
  items: SlashCommandItem[];
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

const SECTION_ORDER: SlashCommandSection[] = ["Basic blocks", "Media & inserts"];

export function createSlashCommandItems(commands: SlashCommandDescriptor[]): SlashCommandItem[] {
  const seen = new Set<string>();
  const items: SlashCommandItem[] = [];

  for (const command of commands) {
    if (seen.has(command.id)) continue;
    seen.add(command.id);
    items.push({
      id: command.id,
      label: command.label,
      group: command.group,
      section: command.section,
      description: command.description,
      icon: command.icon,
      keywords: command.keywords,
      shortcut: command.shortcut ?? "",
      priority: command.priority,
      order: items.length,
    });
  }

  return items.sort(compareSlashCommandItems);
}

export function groupSlashCommandItems(items: SlashCommandItem[]): SlashCommandGroup[] {
  return SECTION_ORDER.map((section) => ({
    section,
    items: items.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0);
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
  const match = textBeforeCaret.match(/(^|[\s\u200b])\/([^/\n]*)$/u);
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

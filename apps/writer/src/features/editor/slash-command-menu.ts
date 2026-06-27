import type { SlashCommand } from "../../domain/engine";

export interface SlashCommandSection {
  group: string;
  commands: SlashCommand[];
}

const DEFAULT_GROUP = "Commands";

export function createSlashCommandSections(
  commands: SlashCommand[],
  query: string,
): SlashCommandSection[] {
  const terms = normalizeQuery(query);
  const sections: SlashCommandSection[] = [];
  const sectionByGroup = new Map<string, SlashCommandSection>();

  for (const command of commands) {
    if (terms.length > 0 && !matchesSlashCommand(command, terms)) {
      continue;
    }

    const group = command.group?.trim() || DEFAULT_GROUP;
    let section = sectionByGroup.get(group);

    if (!section) {
      section = { group, commands: [] };
      sectionByGroup.set(group, section);
      sections.push(section);
    }

    section.commands.push(command);
  }

  return sections;
}

function matchesSlashCommand(command: SlashCommand, terms: string[]): boolean {
  const fields = [
    command.id,
    command.label,
    command.hint,
    command.group ?? "",
    ...(command.keywords ?? []),
  ].map(normalizeText);

  return terms.every((term) => fields.some((field) => field.includes(term)));
}

function normalizeQuery(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WriterCommand } from "../../domain/engine";

export interface CommandPaletteItem {
  id: string;
  label: string;
  group: string;
  keywords: string[];
  shortcut: string;
  scope: string;
  priority: number;
  command: WriterCommand;
  order: number;
}

export interface CommandPaletteGroup {
  group: string;
  items: CommandPaletteItem[];
}

export function createCommandPaletteItems(
  commands: WriterCommand[],
): CommandPaletteItem[] {
  return commands.map((command, order) => ({
    id: command.id,
    label: command.label,
    group: command.group ?? "Commands",
    keywords: command.keywords ?? [],
    shortcut: command.shortcut ?? "",
    scope: command.scope ?? "",
    priority: command.priority ?? 0,
    command,
    order,
  }));
}

export function searchCommandPaletteItems(
  items: CommandPaletteItem[],
  query: string,
): CommandPaletteItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...items].sort(compareCommandPaletteItems);

  return items
    .map((item) => ({
      item,
      score: getCommandPaletteScore(item, normalized),
    }))
    .filter((entry) => entry.score >= 0)
    .sort(
      (a, b) => a.score - b.score || compareCommandPaletteItems(a.item, b.item),
    )
    .map((entry) => entry.item);
}

export function groupCommandPaletteItems(
  items: CommandPaletteItem[],
): CommandPaletteGroup[] {
  const groups: CommandPaletteGroup[] = [];
  const groupsByName = new Map<string, CommandPaletteGroup>();

  for (const item of items) {
    const group = groupsByName.get(item.group);
    if (group) {
      group.items.push(item);
      continue;
    }

    const nextGroup = { group: item.group, items: [item] };
    groupsByName.set(item.group, nextGroup);
    groups.push(nextGroup);
  }

  return groups;
}

interface CommandPaletteProps {
  commands: WriterCommand[];
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onRun: (command: WriterCommand) => void;
}

export function CommandPalette({
  commands,
  query,
  onQueryChange,
  onClose,
  onRun,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const items = useMemo(() => createCommandPaletteItems(commands), [commands]);
  const results = useMemo(
    () => searchCommandPaletteItems(items, query).slice(0, 12),
    [items, query],
  );
  const groupedResults = useMemo(
    () => groupCommandPaletteItems(results),
    [results],
  );
  const displayResults = useMemo(
    () => groupedResults.flatMap((group) => group.items),
    [groupedResults],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex((current) =>
      displayResults.length === 0 ? 0 : Math.min(current, displayResults.length - 1),
    );
  }, [displayResults.length]);

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="command-palette-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-palette-input-row">
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              onQueryChange(event.currentTarget.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
              }

              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (displayResults.length > 0) {
                  setSelectedIndex((current) => (current + 1) % displayResults.length);
                }
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                if (displayResults.length > 0) {
                  setSelectedIndex(
                    (current) =>
                      (current - 1 + displayResults.length) % displayResults.length,
                  );
                }
                return;
              }

              if (event.key === "Enter") {
                event.preventDefault();
                const item = displayResults[selectedIndex];
                if (item) onRun(item.command);
              }
            }}
            placeholder="Search commands"
            aria-label="Search commands"
          />
        </div>
        <div className="command-palette-results" role="listbox">
          {results.length > 0 ? (
            groupedResults.map((group, groupIndex) => (
              <div
                key={`${group.group}-${groupIndex}`}
                className="command-palette-group"
                role="group"
                aria-label={group.group}
              >
                <div className="command-palette-group-label">{group.group}</div>
                {group.items.map((item) => {
                  const index = displayResults.indexOf(item);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={index === selectedIndex ? "is-selected" : undefined}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => onRun(item.command)}
                      role="option"
                      aria-selected={index === selectedIndex}
                    >
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.id}</small>
                      </span>
                      {item.shortcut ? (
                        <kbd className="command-palette-shortcut">
                          {item.shortcut}
                        </kbd>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="command-palette-empty">No commands</div>
          )}
        </div>
      </div>
    </div>
  );
}

function compareCommandPaletteItems(
  a: CommandPaletteItem,
  b: CommandPaletteItem,
): number {
  return b.priority - a.priority || a.order - b.order;
}

function getCommandPaletteScore(
  item: CommandPaletteItem,
  query: string,
): number {
  const label = item.label.toLowerCase();
  const id = item.id.toLowerCase();
  const group = item.group.toLowerCase();

  if (label.includes(query)) return label.startsWith(query) ? 0 : 1;
  if (id.includes(query)) return 2;
  if (group.includes(query)) return 3;
  if (item.keywords.some((keyword) => keyword.toLowerCase().includes(query))) {
    return 4;
  }

  return -1;
}

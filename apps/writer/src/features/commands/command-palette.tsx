import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WriterCommand } from "../../domain/engine";

export interface CommandPaletteItem {
  id: string;
  label: string;
  group: string;
  keywords: string[];
  command: WriterCommand;
  order: number;
}

export function createCommandPaletteItems(
  commands: WriterCommand[],
): CommandPaletteItem[] {
  return commands.map((command, order) => ({
    id: command.id,
    label: command.label,
    group: command.group ?? "Commands",
    keywords: command.keywords ?? [],
    command,
    order,
  }));
}

export function searchCommandPaletteItems(
  items: CommandPaletteItem[],
  query: string,
): CommandPaletteItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...items].sort((a, b) => a.order - b.order);

  return items
    .map((item) => ({
      item,
      score: getCommandPaletteScore(item, normalized),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score || a.item.order - b.item.order)
    .map((entry) => entry.item);
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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex((current) =>
      results.length === 0 ? 0 : Math.min(current, results.length - 1),
    );
  }, [results.length]);

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
                if (results.length > 0) {
                  setSelectedIndex((current) => (current + 1) % results.length);
                }
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                if (results.length > 0) {
                  setSelectedIndex(
                    (current) => (current - 1 + results.length) % results.length,
                  );
                }
                return;
              }

              if (event.key === "Enter") {
                event.preventDefault();
                const item = results[selectedIndex];
                if (item) onRun(item.command);
              }
            }}
            placeholder="Search commands"
            aria-label="Search commands"
          />
        </div>
        <div className="command-palette-results" role="listbox">
          {results.length > 0 ? (
            results.map((item, index) => (
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
                  <small>{item.group}</small>
                </span>
              </button>
            ))
          ) : (
            <div className="command-palette-empty">No commands</div>
          )}
        </div>
      </div>
    </div>
  );
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

import type {
  SlashCommandItem,
  SlashCommandPosition,
} from "./slash-commands";

export const SLASH_COMMAND_MENU_SIZE = {
  width: 280,
  height: 340,
};

interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  position: SlashCommandPosition;
  query: string;
  selectedIndex: number;
  onHover: (index: number) => void;
  onRun: (item: SlashCommandItem) => void;
}

export function SlashCommandMenu({
  items,
  position,
  query,
  selectedIndex,
  onHover,
  onRun,
}: SlashCommandMenuProps) {
  const activeItem = items[selectedIndex];

  return (
    <div
      className="slash-command-menu"
      style={{ left: position.x, top: position.y }}
      role="listbox"
      aria-label="Slash commands"
      aria-activedescendant={
        activeItem ? getSlashCommandOptionId(activeItem.id) : undefined
      }
      onMouseDown={(event) => event.preventDefault()}
    >
      {items.length > 0 ? (
        items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            id={getSlashCommandOptionId(item.id)}
            className={index === selectedIndex ? "is-selected" : undefined}
            role="option"
            aria-selected={index === selectedIndex}
            data-command-id={item.id}
            onMouseEnter={() => onHover(index)}
            onClick={() => onRun(item)}
          >
            <span>
              <strong>{item.label}</strong>
              <small>{item.group}</small>
            </span>
            {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
          </button>
        ))
      ) : (
        <div className="slash-command-empty">
          No blocks for <strong>/{query}</strong>
        </div>
      )}
    </div>
  );
}

export function getSlashCommandOptionId(id: string): string {
  return `slash-command-option-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

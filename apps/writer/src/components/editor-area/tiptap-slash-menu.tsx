import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import {
  getSlashCommandPosition,
  groupSlashCommandItems,
  searchSlashCommandItems,
  type SlashCommandItem,
} from "./slash-commands";
import {
  getTiptapSlashCommandItems,
  getTiptapSlashTrigger,
  runTiptapSlashCommand,
  type TiptapSlashTrigger,
} from "./tiptap-slash-commands";

interface TiptapSlashMenuProps {
  editor: Editor;
}

interface SlashMenuState {
  trigger: TiptapSlashTrigger;
  items: SlashCommandItem[];
  selectedIndex: number;
  x: number;
  y: number;
}

const MENU_SIZE = { width: 330, height: 390 };

export function TiptapSlashMenu({ editor }: TiptapSlashMenuProps) {
  const allItems = useMemo(getTiptapSlashCommandItems, []);
  const [menu, setMenu] = useState<SlashMenuState | null>(null);
  const dismissedFromRef = useRef<number | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(() => {
    if (editor.isDestroyed || !editor.isFocused) {
      setMenu(null);
      return;
    }

    const trigger = getTiptapSlashTrigger(editor.state);
    if (!trigger) {
      dismissedFromRef.current = null;
      setMenu(null);
      return;
    }
    if (dismissedFromRef.current === trigger.from) {
      setMenu(null);
      return;
    }

    const matchingItems = searchSlashCommandItems(allItems, trigger.query);
    const items = groupSlashCommandItems(matchingItems).flatMap((group) => group.items);
    const caret = editor.view.coordsAtPos(trigger.to);
    const position = getSlashCommandPosition(caret, MENU_SIZE, {
      width: window.innerWidth,
      height: window.innerHeight,
    });

    setMenu((current) => {
      const sameTrigger =
        current?.trigger.from === trigger.from &&
        current.trigger.to === trigger.to &&
        current.trigger.query === trigger.query;
      return {
        trigger,
        items,
        selectedIndex: sameTrigger
          ? Math.min(current.selectedIndex, Math.max(0, items.length - 1))
          : 0,
        x: position.x,
        y: position.y,
      };
    });
  }, [allItems, editor]);

  const runItem = useCallback(
    (item: SlashCommandItem) => {
      if (!menu) return;
      const { from, to } = menu.trigger;
      setMenu(null);
      runTiptapSlashCommand(editor, item.id, { from, to });
    },
    [editor, menu],
  );

  useEffect(() => {
    const handleEditorChange = () => refresh();
    const handleBlur = () => setMenu(null);
    const handleViewportChange = () => refresh();

    editor.on("update", handleEditorChange);
    editor.on("selectionUpdate", handleEditorChange);
    editor.on("focus", handleEditorChange);
    editor.on("blur", handleBlur);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    refresh();

    return () => {
      editor.off("update", handleEditorChange);
      editor.off("selectionUpdate", handleEditorChange);
      editor.off("focus", handleEditorChange);
      editor.off("blur", handleBlur);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [editor, refresh]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!menu || event.isComposing) return;

      let nextIndex = menu.selectedIndex;
      if (event.key === "ArrowDown") {
        nextIndex = menu.items.length === 0 ? 0 : (menu.selectedIndex + 1) % menu.items.length;
      } else if (event.key === "ArrowUp") {
        nextIndex =
          menu.items.length === 0
            ? 0
            : (menu.selectedIndex - 1 + menu.items.length) % menu.items.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = Math.max(0, menu.items.length - 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismissedFromRef.current = menu.trigger.from;
        setMenu(null);
        return;
      } else if (event.key === "Enter" || event.key === "Tab") {
        const item = menu.items[menu.selectedIndex];
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        runItem(item);
        return;
      } else {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setMenu((current) => (current ? { ...current, selectedIndex: nextIndex } : null));
    };

    editor.view.dom.addEventListener("keydown", handleKeyDown, true);
    return () => editor.view.dom.removeEventListener("keydown", handleKeyDown, true);
  }, [editor, menu, runItem]);

  useEffect(() => {
    resultsRef.current
      ?.querySelector<HTMLButtonElement>("button.is-selected")
      ?.scrollIntoView({ block: "nearest" });
  }, [menu?.selectedIndex]);

  if (!menu || typeof document === "undefined") return null;

  let itemIndex = 0;
  return createPortal(
    <div
      className="slash-command-menu"
      role="dialog"
      aria-label="Insert block"
      style={{ left: menu.x, top: menu.y }}
    >
      <div ref={resultsRef} className="slash-command-results" role="listbox" aria-label="Blocks">
        {menu.items.length === 0 ? (
          <div className="slash-command-empty">No command for /{menu.trigger.query}</div>
        ) : (
          groupSlashCommandItems(menu.items).map((group) => (
            <section
              key={group.section}
              className="slash-command-section"
              role="group"
              aria-label={group.section}
            >
              <div className="slash-command-section-heading">{group.section}</div>
              {group.items.map((item) => {
                const index = itemIndex++;
                const selected = index === menu.selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={selected ? "is-selected" : undefined}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      runItem(item);
                    }}
                  >
                    <span className="slash-command-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="slash-command-text">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    {item.shortcut ? <kbd>{item.shortcut.replace("Mod", "⌘")}</kbd> : null}
                  </button>
                );
              })}
            </section>
          ))
        )}
      </div>
      <div className="slash-command-footer" aria-hidden="true">
        <span>
          <kbd>↑↓</kbd> Navigate
        </span>
        <span>
          <kbd>↵</kbd> Select
        </span>
        <span>
          <kbd>Esc</kbd> Close
        </span>
      </div>
    </div>,
    document.body,
  );
}

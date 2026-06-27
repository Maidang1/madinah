import { MDXEditor, type MDXEditorMethods } from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MarkdownDocument } from "../../domain/document";
import type { SlashCommand, WorkspaceInfo } from "../../domain/engine";
import { EMPTY_BLOCK_MARKER } from "../engine/builtinProfiles";
import type { CommandRegistry } from "../engine/CommandRegistry";
import {
  createSlashCommandSections,
  type SlashCommandSection,
} from "./slash-command-menu";
import {
  getEditorContextMenuPosition,
  type EditorContextMenuItem,
} from "./editor-context-menu";

interface MarkdownEditorProps {
  value: string;
  document: MarkdownDocument | null;
  workspace: WorkspaceInfo | null;
  editorPlugins: unknown[];
  commandRegistry: CommandRegistry;
  contextMenuItems?: EditorContextMenuItem[];
  onChange: (value: string) => void;
  onError: (error: string) => void;
}

export function MarkdownEditor({
  value,
  document,
  workspace,
  editorPlugins,
  commandRegistry,
  contextMenuItems = [],
  onChange,
  onError,
}: MarkdownEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const initialFocusSelectionRef = useRef<"rootStart" | "rootEnd">(
    getInitialFocusSelection(value),
  );
  const [position, setPosition] = useState<SlashMenuPosition | null>(null);
  const [contextMenu, setContextMenu] = useState<EditorContextMenuState | null>(
    null,
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState("");
  const commands = useMemo(
    () => commandRegistry.listSlashCommands(),
    [commandRegistry],
  );
  const sections = useMemo(
    () => createSlashCommandSections(commands, query),
    [commands, query],
  );
  const visibleCommands = useMemo(
    () => sections.flatMap((section) => section.commands),
    [sections],
  );

  const closeMenu = useCallback(() => {
    setPosition(null);
    setSelectedIndex(0);
    setQuery("");
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const runCommand = useCallback(
    async (command: SlashCommand) => {
      try {
        if (command.markdown) {
          editorRef.current?.insertMarkdown(command.markdown);
        }

        if (command.commandId) {
          await commandRegistry.execute(command.commandId, {
            document,
            editor: editorRef.current,
            workspace,
          });
        }
      } catch (error: unknown) {
        onError(error instanceof Error ? error.message : String(error));
      }

      closeMenu();
      requestAnimationFrame(() =>
        editorRef.current?.focus(undefined, {
          defaultSelection: "rootEnd",
          preventScroll: true,
        }),
      );
      requestAnimationFrame(() => focusInsertedMarker(shellRef.current));
    },
    [closeMenu, commandRegistry, document, onError, workspace],
  );

  const runContextMenuItem = useCallback(
    async (item: EditorContextMenuItem) => {
      if (item.disabled) return;

      closeContextMenu();
      try {
        await commandRegistry.execute(item.commandId, {
          document,
          editor: editorRef.current,
          workspace,
        });
      } catch (error: unknown) {
        onError(error instanceof Error ? error.message : String(error));
      }
    },
    [closeContextMenu, commandRegistry, document, onError, workspace],
  );

  useEffect(() => {
    requestAnimationFrame(() =>
      editorRef.current?.focus(undefined, {
        defaultSelection: initialFocusSelectionRef.current,
        preventScroll: true,
      }),
    );
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };

    window.addEventListener("click", closeContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);
    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu, true);
    };
  }, [closeContextMenu, contextMenu]);

  useEffect(() => {
    if (!position) return;

    const handleMenuKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        if (visibleCommands.length > 0) {
          setSelectedIndex((current) => (current + 1) % visibleCommands.length);
        }
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        if (visibleCommands.length > 0) {
          setSelectedIndex(
            (current) =>
              (current - 1 + visibleCommands.length) % visibleCommands.length,
          );
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const command = visibleCommands[selectedIndex];
        if (command) {
          void runCommand(command);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        event.stopPropagation();
        if (query.length > 0) {
          setQuery((current) => current.slice(0, -1));
        } else {
          closeMenu();
        }
        return;
      }

      if (
        event.key.length === 1 &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        event.stopPropagation();
        setQuery((current) => current + event.key);
        setSelectedIndex(0);
        return;
      }

      if (event.key.length === 1) {
        closeMenu();
      }
    };

    window.addEventListener("keydown", handleMenuKey, true);
    return () => window.removeEventListener("keydown", handleMenuKey, true);
  }, [
    closeMenu,
    position,
    query.length,
    runCommand,
    selectedIndex,
    visibleCommands,
  ]);

  useEffect(() => {
    setSelectedIndex((current) => {
      if (visibleCommands.length === 0) return 0;
      return Math.min(current, visibleCommands.length - 1);
    });
  }, [visibleCommands.length]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        commands.length === 0 ||
        !isCollapsedSelectionInside(shellRef.current)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPosition(getSlashMenuPosition(shellRef.current));
      setSelectedIndex(0);
      setQuery("");
    },
    [commands.length],
  );

  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (contextMenuItems.length === 0) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(".slash-command-menu, .editor-context-menu")
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      setContextMenu({
        position: getEditorContextMenuPosition(
          event,
          { width: 180, height: contextMenuItems.length * 34 + 10 },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      });
    },
    [closeMenu, contextMenuItems.length],
  );

  return (
    <div
      className="live-mdx-shell"
      ref={shellRef}
      onKeyDownCapture={handleKeyDown}
      onContextMenu={handleContextMenu}
    >
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={(markdown, initialMarkdownNormalize) => {
          if (initialMarkdownNormalize) return;
          onChange(cleanEmptyBlockMarkers(markdown));
        }}
        onError={(payload) => onError(payload.error)}
        plugins={editorPlugins as never}
        contentEditableClassName="post-content live-mdx-content"
        className="live-mdx-editor"
        autoFocus={{
          defaultSelection: initialFocusSelectionRef.current,
          preventScroll: true,
        }}
        placeholder={
          <span className="live-mdx-placeholder">Start writing...</span>
        }
        spellCheck
      />
      {position && commands.length > 0 ? (
        <SlashCommandMenu
          query={query}
          sections={sections}
          position={position}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onRun={(command) => void runCommand(command)}
        />
      ) : null}
      {contextMenu ? (
        <EditorContextMenu
          items={contextMenuItems}
          position={contextMenu.position}
          onRun={(item) => void runContextMenuItem(item)}
        />
      ) : null}
    </div>
  );
}

function cleanEmptyBlockMarkers(markdown: string): string {
  return markdown.replaceAll(EMPTY_BLOCK_MARKER, "");
}

function getInitialFocusSelection(markdown: string): "rootStart" | "rootEnd" {
  const normalized = cleanEmptyBlockMarkers(markdown).trim();
  return normalized === "" || normalized === "# Untitled" ? "rootEnd" : "rootStart";
}

function focusInsertedMarker(element: HTMLElement | null): boolean {
  if (!element) return false;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let markerNode: Text | null = null;
  let markerIndex = -1;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue ?? "";
    const index = value.lastIndexOf(EMPTY_BLOCK_MARKER);
    if (index >= 0 && node instanceof Text) {
      markerNode = node;
      markerIndex = index;
    }
  }

  if (!markerNode || markerIndex < 0) return false;

  const range = document.createRange();
  range.setStart(markerNode, markerIndex + EMPTY_BLOCK_MARKER.length);
  range.collapse(true);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  return true;
}

interface SlashMenuPosition {
  left: number;
  top: number;
}

interface EditorContextMenuState {
  position: {
    x: number;
    y: number;
  };
}

interface SlashCommandMenuProps {
  query: string;
  sections: SlashCommandSection[];
  position: SlashMenuPosition;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onRun: (command: SlashCommand) => void;
}

function SlashCommandMenu({
  query,
  sections,
  position,
  selectedIndex,
  onSelect,
  onRun,
}: SlashCommandMenuProps) {
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedButtonRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, sections]);

  let commandIndex = 0;

  return (
    <div
      className="slash-command-menu"
      style={{ left: position.left, top: position.top }}
      role="menu"
      aria-label="Slash commands"
    >
      <div className="slash-command-query" aria-hidden="true">
        <span>/</span>
        {query ? <strong>{query}</strong> : null}
      </div>

      {sections.length > 0 ? (
        sections.map((section) => (
          <div className="slash-command-section" key={section.group}>
            <div className="slash-command-group">{section.group}</div>
            {section.commands.map((command) => {
              const index = commandIndex;
              const isSelected = index === selectedIndex;
              commandIndex += 1;

              return (
                <button
                  type="button"
                  key={command.id}
                  ref={isSelected ? selectedButtonRef : undefined}
                  className={isSelected ? "is-selected" : undefined}
                  onMouseEnter={() => onSelect(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onRun(command);
                  }}
                  role="menuitem"
                >
                  <span>{command.label}</span>
                  <small>{command.hint}</small>
                </button>
              );
            })}
          </div>
        ))
      ) : (
        <div className="slash-command-empty">No commands</div>
      )}
    </div>
  );
}

function EditorContextMenu({
  items,
  position,
  onRun,
}: {
  items: EditorContextMenuItem[];
  position: {
    x: number;
    y: number;
  };
  onRun: (item: EditorContextMenuItem) => void;
}) {
  return (
    <div
      className="editor-context-menu"
      style={{ left: position.x, top: position.y }}
      role="menu"
      aria-label="Editor actions"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => onRun(item)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function isCollapsedSelectionInside(element: HTMLElement | null): boolean {
  if (!element) return false;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return false;
  }

  const anchorNode = selection.anchorNode;
  return anchorNode ? element.contains(anchorNode) : false;
}

function getSlashMenuPosition(element: HTMLElement | null): SlashMenuPosition {
  const selection = window.getSelection();
  const elementRect = element?.getBoundingClientRect();
  if (!elementRect) {
    return { left: 16, top: 16 };
  }

  let left = elementRect.left + 8;
  let top = elementRect.top + 36;

  if (selection && selection.rangeCount > 0) {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width || rect.height) {
      left = rect.left;
      top = rect.bottom + 10;
    }
  }

  return {
    left: Math.max(16, Math.min(left, window.innerWidth - 292)),
    top: Math.max(16, Math.min(top, window.innerHeight - 380)),
  };
}

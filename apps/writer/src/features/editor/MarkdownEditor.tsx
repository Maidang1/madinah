import { MDXEditor, type MDXEditorMethods } from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import {
  type KeyboardEvent as ReactKeyboardEvent,
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

interface MarkdownEditorProps {
  value: string;
  document: MarkdownDocument | null;
  workspace: WorkspaceInfo | null;
  editorPlugins: unknown[];
  commandRegistry: CommandRegistry;
  onChange: (value: string) => void;
  onError: (error: string) => void;
}

export function MarkdownEditor({
  value,
  document,
  workspace,
  editorPlugins,
  commandRegistry,
  onChange,
  onError,
}: MarkdownEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const initialFocusSelectionRef = useRef<"rootStart" | "rootEnd">(
    getInitialFocusSelection(value),
  );
  const [position, setPosition] = useState<SlashMenuPosition | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const commands = useMemo(
    () => commandRegistry.listSlashCommands(),
    [commandRegistry],
  );

  const closeMenu = useCallback(() => {
    setPosition(null);
    setSelectedIndex(0);
  }, []);

  const runCommand = useCallback(
    async (command: SlashCommand) => {
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

      closeMenu();
      requestAnimationFrame(() =>
        editorRef.current?.focus(undefined, {
          defaultSelection: "rootEnd",
          preventScroll: true,
        }),
      );
      requestAnimationFrame(() => focusInsertedMarker(shellRef.current));
    },
    [closeMenu, commandRegistry, document, workspace],
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
    if (!position || commands.length === 0) return;

    const handleMenuKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex((current) => (current + 1) % commands.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex(
          (current) => (current - 1 + commands.length) % commands.length,
        );
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        void runCommand(commands[selectedIndex]);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        return;
      }

      if (event.key.length === 1) {
        closeMenu();
      }
    };

    window.addEventListener("keydown", handleMenuKey, true);
    return () => window.removeEventListener("keydown", handleMenuKey, true);
  }, [closeMenu, commands, position, runCommand, selectedIndex]);

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
    },
    [commands.length],
  );

  return (
    <div
      className="live-mdx-shell"
      ref={shellRef}
      onKeyDownCapture={handleKeyDown}
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
          commands={commands}
          position={position}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onRun={(command) => void runCommand(command)}
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

interface SlashCommandMenuProps {
  commands: SlashCommand[];
  position: SlashMenuPosition;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onRun: (command: SlashCommand) => void;
}

function SlashCommandMenu({
  commands,
  position,
  selectedIndex,
  onSelect,
  onRun,
}: SlashCommandMenuProps) {
  return (
    <div
      className="slash-command-menu"
      style={{ left: position.left, top: position.top }}
      role="menu"
      aria-label="Slash commands"
    >
      {commands.map((command, index) => (
        <button
          type="button"
          key={command.id}
          className={index === selectedIndex ? "is-selected" : undefined}
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

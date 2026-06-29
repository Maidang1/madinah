import { MDXEditor, type MDXEditorMethods } from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import {
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { MarkdownDocument } from "../../domain/document";
import type { WorkspaceInfo, WriterEditor } from "../../domain/engine";
import { EMPTY_BLOCK_MARKER } from "../engine/builtinProfiles";
import type { CommandRegistry } from "../engine/CommandRegistry";
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
  onEditorReady?: (editor: WriterEditor | null) => void;
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
  onEditorReady,
  onChange,
  onError,
}: MarkdownEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const initialFocusSelectionRef = useRef<"rootStart" | "rootEnd">(
    getInitialFocusSelection(value),
  );
  const [contextMenu, setContextMenu] = useState<EditorContextMenuState | null>(
    null,
  );

  useEffect(() => {
    if (!onEditorReady) return;

    onEditorReady(createWriterEditor(editorRef, shellRef, value));
    return () => onEditorReady(null);
  }, [onEditorReady, value]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const runContextMenuItem = useCallback(
    async (item: EditorContextMenuItem) => {
      if (item.disabled) return;

      closeContextMenu();
      try {
        await commandRegistry.execute(item.commandId, {
          document,
          editor: createWriterEditor(editorRef, shellRef, value),
          workspace,
        });
      } catch (error: unknown) {
        onError(error instanceof Error ? error.message : String(error));
      }
    },
    [closeContextMenu, commandRegistry, document, onError, value, workspace],
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

  const handleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (contextMenuItems.length === 0) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(".editor-context-menu")
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        position: getEditorContextMenuPosition(
          event,
          { width: 180, height: contextMenuItems.length * 34 + 10 },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      });
    },
    [contextMenuItems.length],
  );

  return (
    <div
      className="live-mdx-shell"
      ref={shellRef}
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

interface EditorContextMenuState {
  position: {
    x: number;
    y: number;
  };
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

function createWriterEditor(
  editorRef: RefObject<MDXEditorMethods | null>,
  shellRef: RefObject<HTMLDivElement | null>,
  fallbackMarkdown: string,
): WriterEditor {
  return {
    getMarkdown: () => editorRef.current?.getMarkdown() ?? fallbackMarkdown,
    setMarkdown: (markdown) => editorRef.current?.setMarkdown(markdown),
    insertMarkdown: (markdown) => editorRef.current?.insertMarkdown(markdown),
    getSelectionMarkdown: () => getSelectedTextInside(shellRef.current),
    replaceSelection: (markdown) => {
      if (!replaceSelectedTextInside(shellRef.current, markdown)) {
        editorRef.current?.insertMarkdown(markdown);
      }
    },
    focus: () =>
      editorRef.current?.focus(undefined, {
        defaultSelection: "rootEnd",
        preventScroll: true,
      }),
  };
}

function getSelectedTextInside(element: HTMLElement | null): string {
  if (!element) return "";

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return "";

  const anchorNode = selection.anchorNode;
  if (!anchorNode || !element.contains(anchorNode)) return "";

  return selection.toString();
}

function replaceSelectedTextInside(
  element: HTMLElement | null,
  text: string,
): boolean {
  if (!element) return false;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;

  const anchorNode = selection.anchorNode;
  if (!anchorNode || !element.contains(anchorNode)) return false;

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  return true;
}

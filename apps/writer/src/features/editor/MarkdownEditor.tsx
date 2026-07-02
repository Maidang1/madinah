import {
  MDXEditor,
  imagePlugin,
  type ImageUploadHandler,
  type MDXEditorMethods,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MarkdownDocument } from "../../domain/document";
import type { WorkspaceInfo, WriterEditor } from "../../domain/engine";
import type { ElectronContextMenuItem } from "../../platform/electron-api";
/*
import {
  getImageFilesFromClipboardData,
  getMarkdownTextFromClipboardData,
} from "./clipboard";
*/
import {
  createSourceModeEditorPlugin,
  EMPTY_BLOCK_MARKER,
  type MarkdownEditorMode,
} from "../engine/builtinProfiles";
import type { CommandRegistry } from "../engine/CommandRegistry";
import {
  getEditorContextMenuSize,
  getEditorContextMenuPosition,
  isEditorContextMenuSeparator,
  resolveEditorContextMenuItems,
  type EditorContextMenuCommandItem,
  type EditorContextMenuItem,
} from "./editor-context-menu";
import {
  EDITOR_SELECTION_TOOLBAR_ACTIONS,
  EDITOR_SELECTION_TOOLBAR_SIZE,
  EditorSelectionToolbar,
  getEditorSelectionToolbarPosition,
  type EditorSelectionToolbarAction,
  type EditorSelectionToolbarPosition,
} from "./EditorSelectionToolbar";
import {
  SLASH_COMMAND_MENU_SIZE,
  SlashCommandMenu,
} from "./SlashCommandMenu";
import {
  createSlashCommandItems,
  getSlashCommandPosition,
  matchSlashCommandTriggerText,
  replaceSlashTriggerInMarkdown,
  searchSlashCommandItems,
  type SlashCommandItem,
  type SlashCommandPosition,
} from "./slash-commands";

interface MarkdownEditorProps {
  value: string;
  document: MarkdownDocument | null;
  workspace: WorkspaceInfo | null;
  editorPlugins: unknown[];
  editorMode?: MarkdownEditorMode;
  commandRegistry: CommandRegistry;
  autoFocus?: boolean;
  imageUploadHandler?: ImageUploadHandler | null;
  contextMenuItems?: EditorContextMenuItem[];
  onEditorReady?: (editor: WriterEditor | null) => void;
  onChange: (value: string) => void;
  onError: (error: string) => void;
}

export const DOCUMENT_TITLE_PLACEHOLDER = "写下标题";

export function MarkdownEditor({
  value,
  document,
  workspace,
  editorPlugins,
  editorMode = "rich-text",
  commandRegistry,
  autoFocus = true,
  imageUploadHandler = null,
  contextMenuItems = [],
  onEditorReady,
  onChange,
  onError,
}: MarkdownEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const shouldAutoFocusRef = useRef(autoFocus);
  const initialFocusSelectionRef = useRef<"rootStart" | "rootEnd">(
    getInitialFocusSelection(value),
  );
  const [contextMenu, setContextMenu] = useState<EditorContextMenuState | null>(
    null,
  );
  const [slashMenu, setSlashMenu] = useState<SlashCommandMenuState | null>(null);
  const [selectionToolbar, setSelectionToolbar] =
    useState<EditorSelectionToolbarState | null>(null);
  const slashCommandItems = useMemo(
    () => createSlashCommandItems(commandRegistry.list()),
    [commandRegistry],
  );
  const slashCommandResults = useMemo(
    () =>
      slashMenu
        ? searchSlashCommandItems(slashCommandItems, slashMenu.query).slice(0, 10)
        : [],
    [slashCommandItems, slashMenu],
  );
  const resolvedEditorPlugins = useMemo(
    () => [
      ...editorPlugins,
      imagePlugin({ imageUploadHandler }),
      createSourceModeEditorPlugin(editorMode),
    ],
    [editorMode, editorPlugins, imageUploadHandler],
  );
  const restoreEditorFocus = useCallback(() => {
    requestAnimationFrame(() =>
      editorRef.current?.focus(undefined, {
        defaultSelection: "rootEnd",
        preventScroll: true,
      }),
    );
  }, []);

  useEffect(() => {
    if (!onEditorReady) return;

    onEditorReady(createWriterEditor(editorRef, shellRef, value));
    return () => onEditorReady(null);
  }, [onEditorReady, value]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const closeSlashMenu = useCallback(() => {
    setSlashMenu(null);
  }, []);

  const closeSelectionToolbar = useCallback(() => {
    setSelectionToolbar(null);
  }, []);

  const runContextMenuItem = useCallback(
    async (item: EditorContextMenuCommandItem) => {
      if (item.disabled) return;

      closeContextMenu();
      try {
        await commandRegistry.execute(item.commandId, {
          document,
          editor: createWriterEditor(editorRef, shellRef, value),
          workspace,
        });
        restoreEditorFocus();
      } catch (error: unknown) {
        onError(error instanceof Error ? error.message : String(error));
      }
    },
    [
      closeContextMenu,
      commandRegistry,
      document,
      onError,
      restoreEditorFocus,
      value,
      workspace,
    ],
  );

  const runSelectionToolbarAction = useCallback(
    async (action: EditorSelectionToolbarAction) => {
      const editor = createWriterEditor(editorRef, shellRef, value);
      closeSelectionToolbar();

      try {
        await commandRegistry.execute(action.commandId, {
          document,
          editor,
          workspace,
        });
        editor.focus?.();
      } catch (error: unknown) {
        onError(error instanceof Error ? error.message : String(error));
      }
    },
    [
      closeSelectionToolbar,
      commandRegistry,
      document,
      onError,
      value,
      workspace,
    ],
  );

  const updateSlashMenu = useCallback(() => {
    if (contextMenu || slashCommandItems.length === 0) {
      setSlashMenu(null);
      return;
    }

    const trigger = getSlashCommandTrigger(
      shellRef.current,
      window.getSelection(),
    );
    if (!trigger) {
      setSlashMenu(null);
      return;
    }

    closeSelectionToolbar();
    setSlashMenu((current) => ({
      query: trigger.query,
      position: trigger.position,
      triggerText: trigger.triggerText,
      selectedIndex:
        current?.query === trigger.query ? current.selectedIndex : 0,
    }));
  }, [closeSelectionToolbar, contextMenu, slashCommandItems.length]);

  const scheduleSlashMenuUpdate = useCallback(() => {
    requestAnimationFrame(updateSlashMenu);
  }, [updateSlashMenu]);

  const runSlashCommand = useCallback(
    async (item: SlashCommandItem) => {
      const activeSlashMenu = slashMenu;
      if (!activeSlashMenu) return;

      closeSlashMenu();
      closeSelectionToolbar();

      const editor = createSlashWriterEditor(
        editorRef,
        value,
        activeSlashMenu.triggerText,
        onChange,
      );

      try {
        await commandRegistry.execute(item.command.id, {
          document,
          editor,
          workspace,
        });
        editor.focus?.();
      } catch (error: unknown) {
        onError(error instanceof Error ? error.message : String(error));
      }
    },
    [
      closeSelectionToolbar,
      closeSlashMenu,
      commandRegistry,
      document,
      onChange,
      onError,
      slashMenu,
      value,
      workspace,
    ],
  );

  const handleEditorKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!slashMenu) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeSlashMenu();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setSlashMenu((current) =>
          current
            ? {
                ...current,
                selectedIndex:
                  slashCommandResults.length === 0
                    ? 0
                    : (current.selectedIndex + 1) % slashCommandResults.length,
              }
            : current,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setSlashMenu((current) =>
          current
            ? {
                ...current,
                selectedIndex:
                  slashCommandResults.length === 0
                    ? 0
                    : (current.selectedIndex - 1 + slashCommandResults.length) %
                      slashCommandResults.length,
              }
            : current,
        );
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const item = slashCommandResults[slashMenu.selectedIndex];
        if (!item) return;

        void runSlashCommand(item);
      }
    },
    [closeSlashMenu, runSlashCommand, slashCommandResults, slashMenu],
  );

  useEffect(() => {
    if (!slashMenu) return;

    setSlashMenu((current) => {
      if (!current) return current;
      const maxIndex = Math.max(0, slashCommandResults.length - 1);
      return current.selectedIndex <= maxIndex
        ? current
        : { ...current, selectedIndex: maxIndex };
    });
  }, [slashCommandResults.length, slashMenu]);

  useEffect(() => {
    if (!shouldAutoFocusRef.current) return;

    requestAnimationFrame(() =>
      editorRef.current?.focus(undefined, {
        defaultSelection: initialFocusSelectionRef.current,
        preventScroll: true,
      }),
    );
  }, []);

  /*
  // Custom clipboard handling is parked while the editor returns to the
  // MDXEditor-managed paste flow.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        !shell.querySelector(".live-mdx-content")?.contains(target)
      ) {
        return;
      }

      const imageFiles = imageUploadHandler
        ? getImageFilesFromClipboardData(event.clipboardData)
        : [];
      const text = getMarkdownTextFromClipboardData(event.clipboardData);

      // Let the editor handle anything we don't explicitly take over.
      if (imageFiles.length === 0 && text === null) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      if (text !== null) {
        editorRef.current?.insertMarkdown(text);
        return;
      }

      if (imageFiles.length > 0 && imageUploadHandler) {
        void uploadPastedImages(imageFiles, imageUploadHandler, editorRef, onError);
      }
    };

    shell.addEventListener("paste", handlePaste, true);
    return () => shell.removeEventListener("paste", handlePaste, true);
  }, [imageUploadHandler, onError]);
  */

  const updateSelectionToolbar = useCallback(() => {
    if (contextMenu) return;

    const selection = window.getSelection();
    const range = getSelectionRangeInside(shellRef.current, selection);
    if (!range) {
      setSelectionToolbar(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    setSelectionToolbar({
      position: getEditorSelectionToolbarPosition(
        rect,
        EDITOR_SELECTION_TOOLBAR_SIZE,
        { width: window.innerWidth, height: window.innerHeight },
      ),
    });
  }, [contextMenu]);

  const scheduleSelectionToolbarUpdate = useCallback(() => {
    requestAnimationFrame(updateSelectionToolbar);
  }, [updateSelectionToolbar]);

  useEffect(() => {
    globalThis.document.addEventListener(
      "selectionchange",
      scheduleSelectionToolbarUpdate,
    );
    globalThis.document.addEventListener("selectionchange", scheduleSlashMenuUpdate);
    window.addEventListener("mouseup", scheduleSelectionToolbarUpdate);
    window.addEventListener("keyup", scheduleSelectionToolbarUpdate);
    window.addEventListener("resize", closeSelectionToolbar);
    window.addEventListener("resize", closeSlashMenu);
    window.addEventListener("scroll", closeSelectionToolbar, true);
    window.addEventListener("scroll", closeSlashMenu, true);

    return () => {
      globalThis.document.removeEventListener(
        "selectionchange",
        scheduleSelectionToolbarUpdate,
      );
      globalThis.document.removeEventListener(
        "selectionchange",
        scheduleSlashMenuUpdate,
      );
      window.removeEventListener("mouseup", scheduleSelectionToolbarUpdate);
      window.removeEventListener("keyup", scheduleSelectionToolbarUpdate);
      window.removeEventListener("resize", closeSelectionToolbar);
      window.removeEventListener("resize", closeSlashMenu);
      window.removeEventListener("scroll", closeSelectionToolbar, true);
      window.removeEventListener("scroll", closeSlashMenu, true);
    };
  }, [
    closeSelectionToolbar,
    closeSlashMenu,
    scheduleSelectionToolbarUpdate,
    scheduleSlashMenuUpdate,
  ]);

  useEffect(() => {
    if (!selectionToolbar) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSelectionToolbar();
        restoreEditorFocus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSelectionToolbar, restoreEditorFocus, selectionToolbar]);

  useEffect(() => {
    if (!contextMenu) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
        restoreEditorFocus();
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
  }, [closeContextMenu, contextMenu, restoreEditorFocus]);

  useEffect(() => {
    if (!slashMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(".slash-command-menu")
      ) {
        return;
      }

      closeSlashMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSlashMenu();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeSlashMenu, slashMenu]);

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
      closeSlashMenu();
      closeSelectionToolbar();
      const hasSelection = Boolean(
        getSelectionRangeInside(shellRef.current, window.getSelection()),
      );
      const items = resolveEditorContextMenuItems(
        contextMenuItems,
        hasSelection,
      );

      if (window.madinahWriter) {
        if (!hasSelection) {
          editorRef.current?.focus(undefined, {
            defaultSelection: "rootEnd",
            preventScroll: true,
          });
        }

        void showNativeEditorContextMenu({
          items,
          hasSelection,
          position: {
            x: event.clientX,
            y: event.clientY,
          },
          onRun: runContextMenuItem,
        });
        return;
      }

      setContextMenu({
        position: getEditorContextMenuPosition(
          event,
          getEditorContextMenuSize(items),
          { width: window.innerWidth, height: window.innerHeight },
        ),
        items,
      });
    },
    [closeSelectionToolbar, closeSlashMenu, contextMenuItems, runContextMenuItem],
  );

  return (
    <div
      className={[
        "live-mdx-shell",
        isEditorEmptyDocument(value) ? "is-empty-document" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={shellRef}
      onContextMenu={handleContextMenu}
      onInput={scheduleSlashMenuUpdate}
      onKeyDownCapture={handleEditorKeyDown}
    >
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={(markdown, initialMarkdownNormalize) => {
          if (initialMarkdownNormalize) return;
          onChange(cleanEmptyBlockMarkers(markdown));
        }}
        onError={(payload) => onError(payload.error)}
        plugins={resolvedEditorPlugins as never}
        contentEditableClassName="post-content live-mdx-content"
        className="live-mdx-editor"
        autoFocus={
          shouldAutoFocusRef.current
            ? {
                defaultSelection: initialFocusSelectionRef.current,
                preventScroll: true,
              }
            : undefined
        }
        placeholder={getEditorInlinePlaceholder()}
        spellCheck
      />
      {contextMenu ? (
        <EditorContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onRun={(item) => void runContextMenuItem(item)}
        />
      ) : null}
      {selectionToolbar ? (
        <EditorSelectionToolbar
          actions={EDITOR_SELECTION_TOOLBAR_ACTIONS}
          position={selectionToolbar.position}
          onRun={(action) => void runSelectionToolbarAction(action)}
        />
      ) : null}
      {slashMenu ? (
        <SlashCommandMenu
          items={slashCommandResults}
          position={slashMenu.position}
          query={slashMenu.query}
          selectedIndex={slashMenu.selectedIndex}
          onHover={(selectedIndex) =>
            setSlashMenu((current) =>
              current ? { ...current, selectedIndex } : current,
            )
          }
          onRun={(item) => void runSlashCommand(item)}
        />
      ) : null}
    </div>
  );
}

export function isEditorEmptyDocument(markdown: string): boolean {
  const normalized = cleanEmptyBlockMarkers(markdown).trim();
  return normalized === "" || normalized === "# Untitled";
}

export function getEditableEmptyDocumentMarkdown(markdown: string): string {
  return cleanEmptyBlockMarkers(markdown).trim() === "# Untitled" ? "" : markdown;
}

export function shouldShowDocumentStartState(
  markdown: string,
  hasStartedEditing: boolean,
): boolean {
  return isEditorEmptyDocument(markdown) && !hasStartedEditing;
}

export function getEditorInlinePlaceholder() {
  return null;
}

export function splitDocumentEditorMarkdown(markdown: string): {
  title: string;
  body: string;
} {
  const match = markdown.match(
    /^(?:[ \t]*\r?\n)*#\s+([^\r\n]+?)[ \t]*(?:\r?\n|$)/,
  );

  if (!match || match.index !== 0) {
    return { title: "", body: markdown };
  }

  return {
    title: normalizeDocumentTitle(match[1]),
    body: markdown.slice(match[0].length).replace(/^(?:[ \t]*\r?\n)+/, ""),
  };
}

export function composeDocumentEditorMarkdown(
  title: string,
  body: string,
): string {
  const normalizedTitle = normalizeDocumentTitle(title);
  const normalizedBody = body.replace(/^(?:[ \t]*\r?\n)+/, "");

  if (!normalizedTitle) return normalizedBody;
  if (!normalizedBody.trim()) return `# ${normalizedTitle}\n\n`;

  return `# ${normalizedTitle}\n\n${normalizedBody}`;
}

export function getDocumentEditorTitle(
  markdown: string,
  metadataTitle: string,
): string {
  const { title } = splitDocumentEditorMarkdown(markdown);
  if (title) return title;

  const normalizedMetadataTitle = normalizeDocumentTitle(metadataTitle);
  return normalizedMetadataTitle === "Untitled" ? "" : normalizedMetadataTitle;
}

export function shouldAutoFocusDocumentTitle(title: string): boolean {
  return normalizeDocumentTitle(title) === "";
}

function cleanEmptyBlockMarkers(markdown: string): string {
  return markdown.replaceAll(EMPTY_BLOCK_MARKER, "");
}

function normalizeDocumentTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim();
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
  items: EditorContextMenuItem[];
}

interface EditorSelectionToolbarState {
  position: EditorSelectionToolbarPosition;
}

interface SlashCommandMenuState {
  query: string;
  position: SlashCommandPosition;
  triggerText: string;
  selectedIndex: number;
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
  onRun: (item: EditorContextMenuCommandItem) => void;
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
      {items.map((item) =>
        isEditorContextMenuSeparator(item) ? (
          <div
            key={item.id}
            className="editor-context-menu-separator"
            role="separator"
          />
        ) : (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => onRun(item)}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

async function showNativeEditorContextMenu({
  items,
  hasSelection,
  position,
  onRun,
}: {
  items: EditorContextMenuItem[];
  hasSelection: boolean;
  position: {
    x: number;
    y: number;
  };
  onRun: (item: EditorContextMenuCommandItem) => void;
}): Promise<void> {
  if (!window.madinahWriter) return;

  const commandItems = items.filter(
    (item): item is EditorContextMenuCommandItem =>
      !isEditorContextMenuSeparator(item),
  );
  const commandItemsById = new Map(commandItems.map((item) => [item.id, item]));
  const nativeEditItems: ElectronContextMenuItem<string>[] = [
    { role: "cut", disabled: !hasSelection },
    { role: "copy", disabled: !hasSelection },
    { role: "paste" },
    { role: "pasteAndMatchStyle" },
  ];
  const nativeSelectionItems: ElectronContextMenuItem<string>[] = [
    { role: "selectAll" },
  ];
  const groups: ElectronContextMenuItem<string>[][] = [
    nativeEditItems,
    nativeSelectionItems,
    commandItems.map((item) => ({
      id: item.id,
      label: item.label,
      disabled: item.disabled,
    })),
  ].filter((group) => group.length > 0);

  const actionId = await window.madinahWriter.dialog.showContextMenu({
    groups,
    position,
  });
  if (!actionId) return;

  const item = commandItemsById.get(actionId);
  if (item && !item.disabled) {
    onRun(item);
  }
}

/*
async function uploadPastedImages(
  imageFiles: File[],
  imageUploadHandler: ImageUploadHandler,
  editorRef: RefObject<MDXEditorMethods | null>,
  onError: (error: string) => void,
): Promise<void> {
  if (!imageUploadHandler) return;

  for (const file of imageFiles) {
    try {
      const url = await imageUploadHandler(file);
      const altText = file.name.replace(/\.[^.]+$/, "");
      editorRef.current?.insertMarkdown(`![${altText}](${url})\n\n`);
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }
}
*/

function createSlashWriterEditor(
  editorRef: RefObject<MDXEditorMethods | null>,
  fallbackMarkdown: string,
  triggerText: string,
  onChange: (value: string) => void,
): WriterEditor {
  const insertAtSlashRange = (markdown: string) => {
    const currentMarkdown = editorRef.current?.getMarkdown() ?? fallbackMarkdown;
    const nextMarkdown = replaceSlashTriggerInMarkdown(
      currentMarkdown,
      triggerText,
      markdown,
    );
    editorRef.current?.setMarkdown(nextMarkdown);
    onChange(cleanEmptyBlockMarkers(nextMarkdown));
  };

  return {
    getMarkdown: () => editorRef.current?.getMarkdown() ?? fallbackMarkdown,
    setMarkdown: (markdown) => editorRef.current?.setMarkdown(markdown),
    insertMarkdown: insertAtSlashRange,
    getSelectionMarkdown: () => "",
    replaceSelection: insertAtSlashRange,
    focus: () =>
      editorRef.current?.focus(undefined, {
        preventScroll: true,
      }),
  };
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

function getSlashCommandTrigger(
  shell: HTMLElement | null,
  selection: Selection | null,
): SlashCommandMenuState | null {
  if (!shell || !selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null;
  }

  const contentRoot = shell.querySelector<HTMLElement>(".live-mdx-content");
  if (!contentRoot) return null;

  const anchorNode = selection.anchorNode;
  if (!anchorNode || !contentRoot.contains(anchorNode)) return null;

  const block = getSlashCommandBlockElement(contentRoot, anchorNode);
  if (!block) return null;

  const caretRange = selection.getRangeAt(0).cloneRange();
  const textBeforeCaret = getTextBeforeCaret(block, caretRange);
  if (textBeforeCaret === null) return null;

  const trigger = matchSlashCommandTriggerText(textBeforeCaret);
  if (!trigger) return null;

  return {
    query: trigger.query,
    position: getSlashCommandPosition(
      getSlashCommandCaretRect(caretRange, block),
      SLASH_COMMAND_MENU_SIZE,
      { width: window.innerWidth, height: window.innerHeight },
    ),
    triggerText: textBeforeCaret.slice(trigger.slashOffset),
    selectedIndex: 0,
  };
}

function getSlashCommandBlockElement(
  contentRoot: HTMLElement,
  node: Node,
): HTMLElement | null {
  const element =
    node instanceof HTMLElement ? node : node.parentElement;
  if (!element) return null;

  const block = element.closest<HTMLElement>(
    "p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th",
  );

  if (block && contentRoot.contains(block)) return block;
  return contentRoot;
}

function getTextBeforeCaret(block: HTMLElement, caretRange: Range): string | null {
  try {
    const range = document.createRange();
    range.selectNodeContents(block);
    range.setEnd(caretRange.endContainer, caretRange.endOffset);
    return range.toString();
  } catch {
    return null;
  }
}

function getSlashCommandCaretRect(range: Range, block: HTMLElement): DOMRect {
  const rect = range.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) return rect;

  const fallback = block.getBoundingClientRect();
  return new DOMRect(
    fallback.left,
    fallback.top,
    Math.max(fallback.width, 1),
    Math.max(fallback.height, 1),
  );
}

function getSelectedTextInside(element: HTMLElement | null): string {
  const selection = window.getSelection();
  if (!getSelectionRangeInside(element, selection)) return "";
  return selection?.toString() ?? "";
}

function replaceSelectedTextInside(
  element: HTMLElement | null,
  text: string,
): boolean {
  if (!element) return false;

  const selection = window.getSelection();
  const range = getSelectionRangeInside(element, selection);
  if (!selection || !range) return false;

  if (
    typeof document.execCommand === "function" &&
    document.execCommand("insertText", false, text)
  ) {
    return true;
  }

  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text,
    }),
  );
  return true;
}

function getSelectionRangeInside(
  element: HTMLElement | null,
  selection: Selection | null,
): Range | null {
  if (!element || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  if (!anchorNode || !focusNode) return null;
  if (!element.contains(anchorNode) || !element.contains(focusNode)) return null;

  const text = selection.toString();
  if (!text.trim()) return null;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  return range;
}

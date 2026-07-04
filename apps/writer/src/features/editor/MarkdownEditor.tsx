import { EditorSelection, EditorState, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MarkdownDocument } from "../../domain/document";
import type { WorkspaceInfo, WriterEditor } from "../../domain/engine";
import type { ElectronContextMenuItem } from "../../platform/electron-api";
import {
  getImageFilesFromClipboardData,
  getMarkdownTextFromClipboardData,
} from "./clipboard";
import { createWriterCodeMirrorExtensions } from "./codemirror/editor-extensions";
import {
  type MarkdownEditorMode,
  resolveMarkdownEditorSyntax,
} from "./codemirror/profile";
import {
  getWrappedSelection,
  isWrappingKey,
} from "./wrap-selection";
import type { CommandRegistry } from "../engine/CommandRegistry";
import { EMPTY_BLOCK_MARKER } from "../engine/builtinProfiles";
import {
  getEditorContextMenuPosition,
  getEditorContextMenuSize,
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
  isInlineSlashCommandId,
  matchSlashCommandTriggerText,
  searchSlashCommandItems,
  type SlashCommandItem,
  type SlashCommandPosition,
} from "./slash-commands";

export type ImageUploadHandler = (image: File | null) => Promise<string>;

const EMPTY_DISABLED_COMMAND_IDS: readonly string[] = [];

interface MarkdownEditorProps {
  value: string;
  valueEpoch: number;
  documentId: string | null;
  documentRef: RefObject<MarkdownDocument | null>;
  workspaceRef: RefObject<WorkspaceInfo | null>;
  editorExtensions: unknown[];
  editorMode?: MarkdownEditorMode;
  commandRegistry: CommandRegistry;
  autoFocus?: boolean;
  imageUploadHandler?: ImageUploadHandler | null;
  contextMenuItems?: EditorContextMenuItem[];
  isAiOperationRunning?: boolean;
  activeAiCommandId?: string | null;
  onEditorReady?: (editor: WriterEditor | null) => void;
  onChange: (value: string) => void;
  onError: (error: string) => void;
}

export const DOCUMENT_TITLE_PLACEHOLDER = "写下标题";

export const MarkdownEditor = memo(function MarkdownEditor({
  value,
  valueEpoch,
  documentRef,
  workspaceRef,
  editorExtensions,
  editorMode = "rich-text",
  commandRegistry,
  autoFocus = true,
  imageUploadHandler = null,
  contextMenuItems = [],
  isAiOperationRunning = false,
  activeAiCommandId = null,
  onEditorReady,
  onChange,
  onError,
}: MarkdownEditorProps) {
  const editorViewRef = useRef<EditorView | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const lastEpochRef = useRef(valueEpoch);
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onError);
  const imageUploadHandlerRef = useRef(imageUploadHandler);
  const onEditorReadyRef = useRef(onEditorReady);
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
  const slashMenuRef = useRef<SlashCommandMenuState | null>(null);
  const selectionToolbarRef = useRef<EditorSelectionToolbarState | null>(null);
  const slashMenuFrameRef = useRef<number | null>(null);
  const selectionToolbarFrameRef = useRef<number | null>(null);
  const editorSyntax = useMemo(
    () => resolveMarkdownEditorSyntax(editorExtensions),
    [editorExtensions],
  );
  const slashCommandItems = useMemo(
    () => createSlashCommandItems(commandRegistry.list("slash")),
    [commandRegistry],
  );
  const slashCommandResults = useMemo(
    () =>
      slashMenu
        ? searchSlashCommandItems(slashCommandItems, slashMenu.query)
            .filter(
              (item) =>
                slashMenu.atLineStart || isInlineSlashCommandId(item.id),
            )
            .slice(0, 10)
        : [],
    [slashCommandItems, slashMenu],
  );
  const disabledContextMenuCommandIds = useMemo(
    () =>
      isAiOperationRunning
        ? getAiCommandIdsFromContextMenuItems(contextMenuItems)
        : EMPTY_DISABLED_COMMAND_IDS,
    [contextMenuItems, isAiOperationRunning],
  );
  const disabledSelectionToolbarCommandIds = useMemo(
    () =>
      isAiOperationRunning
        ? getAiCommandIdsFromSelectionToolbarActions(
            EDITOR_SELECTION_TOOLBAR_ACTIONS,
          )
        : EMPTY_DISABLED_COMMAND_IDS,
    [isAiOperationRunning],
  );

  slashMenuRef.current = slashMenu;
  selectionToolbarRef.current = selectionToolbar;
  onChangeRef.current = onChange;
  onErrorRef.current = onError;
  imageUploadHandlerRef.current = imageUploadHandler;
  onEditorReadyRef.current = onEditorReady;

  const syncEmptyDocumentClass = useCallback((markdown: string) => {
    shellRef.current?.classList.toggle(
      "is-empty-document",
      isEditorEmptyDocument(markdown),
    );
  }, []);

  const replaceEditorDocument = useCallback(
    (
      markdown: string,
      options: {
        notify: boolean;
        selection?: "rootStart" | "rootEnd";
      },
    ) => {
      const view = editorViewRef.current;
      valueRef.current = markdown;
      syncEmptyDocumentClass(markdown);

      if (!view) return;

      const cursor =
        options.selection === "rootStart"
          ? 0
          : options.selection === "rootEnd"
            ? markdown.length
            : Math.min(view.state.selection.main.head, markdown.length);

      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: markdown },
        selection: EditorSelection.cursor(cursor),
        annotations: [
          Transaction.addToHistory.of(false),
          Transaction.userEvent.of(
            options.notify ? "writer.setMarkdown" : "writer.external",
          ),
        ],
        scrollIntoView: false,
      });

    },
    [syncEmptyDocumentClass],
  );

  const restoreEditorFocus = useCallback(() => {
    requestAnimationFrame(() =>
      focusEditor(editorViewRef.current, "rootEnd", true),
    );
  }, []);

  useEffect(() => {
    valueRef.current = value;
    if (lastEpochRef.current === valueEpoch) return;
    lastEpochRef.current = valueEpoch;

    const current = editorViewRef.current?.state.doc.toString() ?? "";
    if (current.trim() === value.trim()) return;

    replaceEditorDocument(value, { notify: false });
  }, [replaceEditorDocument, value, valueEpoch]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const closeSlashMenu = useCallback(() => {
    setSlashMenu(null);
  }, []);

  const closeSelectionToolbar = useCallback(() => {
    setSelectionToolbar(null);
  }, []);

  const createEditor = useCallback(
    (): WriterEditor =>
      createWriterEditor({
        viewRef: editorViewRef,
        shellRef,
        fallbackMarkdownRef: valueRef,
        setMarkdown: (markdown, selection) =>
          replaceEditorDocument(markdown, {
            notify: true,
            selection,
          }),
      }),
    [replaceEditorDocument],
  );

  const runContextMenuItem = useCallback(
    async (item: EditorContextMenuCommandItem) => {
      if (item.disabled) return;

      closeContextMenu();
      try {
        await commandRegistry.execute(item.commandId, {
          document: documentRef.current,
          editor: createEditor(),
          workspace: workspaceRef.current,
        });
        restoreEditorFocus();
      } catch (error: unknown) {
        onErrorRef.current(error instanceof Error ? error.message : String(error));
      }
    },
    [
      closeContextMenu,
      commandRegistry,
      createEditor,
      documentRef,
      restoreEditorFocus,
      workspaceRef,
    ],
  );

  const runSelectionToolbarAction = useCallback(
    async (action: EditorSelectionToolbarAction) => {
      if (isAiOperationRunning && isAiCommandId(action.commandId)) return;

      const editor = createEditor();
      closeSelectionToolbar();

      try {
        await commandRegistry.execute(action.commandId, {
          document: documentRef.current,
          editor,
          workspace: workspaceRef.current,
        });
        editor.focus?.();
      } catch (error: unknown) {
        onErrorRef.current(error instanceof Error ? error.message : String(error));
      }
    },
    [
      closeSelectionToolbar,
      commandRegistry,
      createEditor,
      documentRef,
      isAiOperationRunning,
      workspaceRef,
    ],
  );

  const updateSlashMenu = useCallback(() => {
    const view = editorViewRef.current;
    if (contextMenu || slashCommandItems.length === 0 || !view) {
      setSlashMenu(null);
      return;
    }

    const trigger = getSlashCommandTrigger(view);
    if (!trigger) {
      setSlashMenu(null);
      return;
    }

    closeSelectionToolbar();
    setSlashMenu((current) => ({
      ...trigger,
      selectedIndex:
        current?.query === trigger.query ? current.selectedIndex : 0,
    }));
  }, [closeSelectionToolbar, contextMenu, slashCommandItems.length]);

  const scheduleSlashMenuUpdate = useCallback(() => {
    if (slashMenuFrameRef.current !== null) return;

    slashMenuFrameRef.current = requestAnimationFrame(() => {
      slashMenuFrameRef.current = null;
      updateSlashMenu();
    });
  }, [updateSlashMenu]);

  const scheduleSlashMenuUpdateIfOpen = useCallback(() => {
    if (!slashMenuRef.current) return;
    scheduleSlashMenuUpdate();
  }, [scheduleSlashMenuUpdate]);

  const runSlashCommand = useCallback(
    async (item: SlashCommandItem) => {
      const activeSlashMenu = slashMenuRef.current;
      const view = editorViewRef.current;
      if (!activeSlashMenu || !view) return;

      closeSlashMenu();
      closeSelectionToolbar();

      const editor = createSlashWriterEditor({
        view,
        range: activeSlashMenu.range,
      });

      try {
        await commandRegistry.execute(item.command.id, {
          document: documentRef.current,
          editor,
          workspace: workspaceRef.current,
        });
        editor.focus?.();
      } catch (error: unknown) {
        onErrorRef.current(error instanceof Error ? error.message : String(error));
      }
    },
    [
      closeSelectionToolbar,
      closeSlashMenu,
      commandRegistry,
      documentRef,
      workspaceRef,
    ],
  );

  const handleEditorKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const view = editorViewRef.current;
      if (!view) return;

      if (
        editorMode === "rich-text" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        isWrappingKey(event.key)
      ) {
        const range = view.state.selection.main;
        if (!range.empty) {
          const selectedText = view.state.sliceDoc(range.from, range.to);
          const wrapped = getWrappedSelection(event.key, selectedText);
          if (wrapped) {
            event.preventDefault();
            event.stopPropagation();
            view.dispatch({
              changes: { from: range.from, to: range.to, insert: wrapped.text },
              selection: EditorSelection.range(
                range.from + wrapped.opening.length,
                range.from + wrapped.opening.length + selectedText.length,
              ),
              userEvent: "input.wrapSelection",
            });
            return;
          }
        }
      }

      if (!slashMenuRef.current) return;

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
        const activeSlashMenu = slashMenuRef.current;
        const item =
          activeSlashMenu && slashCommandResults[activeSlashMenu.selectedIndex];
        if (!item) return;

        void runSlashCommand(item);
      }
    },
    [closeSlashMenu, editorMode, runSlashCommand, slashCommandResults],
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

  const updateSelectionToolbar = useCallback(() => {
    if (contextMenu) return;

    const view = editorViewRef.current;
    if (!view) {
      setSelectionToolbar(null);
      return;
    }

    const range = view.state.selection.main;
    if (range.empty) {
      setSelectionToolbar(null);
      return;
    }

    const rect = getEditorSelectionRect(view, range.from, range.to);
    if (!rect) {
      setSelectionToolbar(null);
      return;
    }

    setSelectionToolbar({
      position: getEditorSelectionToolbarPosition(
        rect,
        EDITOR_SELECTION_TOOLBAR_SIZE,
        { width: window.innerWidth, height: window.innerHeight },
      ),
    });
  }, [contextMenu]);

  const scheduleSelectionToolbarUpdate = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;
    if (!selectionToolbarRef.current && view.state.selection.main.empty) return;
    if (selectionToolbarFrameRef.current !== null) return;

    selectionToolbarFrameRef.current = requestAnimationFrame(() => {
      selectionToolbarFrameRef.current = null;
      updateSelectionToolbar();
    });
  }, [updateSelectionToolbar]);

  const mountEditor = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) {
        editorViewRef.current?.destroy();
        editorViewRef.current = null;
        onEditorReadyRef.current?.(null);
        return;
      }

      if (editorViewRef.current) return;

      const updateListener = EditorView.updateListener.of((update) => {
        const isExternal = update.transactions.some((transaction) =>
          transaction.isUserEvent("writer.external"),
        );

        if (update.docChanged && !isExternal) {
          const nextMarkdown = cleanEmptyBlockMarkers(update.state.doc.toString());
          valueRef.current = nextMarkdown;
          syncEmptyDocumentClass(nextMarkdown);
          onChangeRef.current(nextMarkdown);
          scheduleSlashMenuUpdate();
        }

        if (update.selectionSet || update.docChanged) {
          scheduleSelectionToolbarUpdate();
          scheduleSlashMenuUpdateIfOpen();
        }
      });

      const pasteHandlers = EditorView.domEventHandlers({
        paste(event, view) {
          return handleEditorPaste(event, view, {
            imageUploadHandlerRef,
            onErrorRef,
          });
        },
      });

      const view = new EditorView({
        parent: element,
        state: EditorState.create({
          doc: valueRef.current,
          extensions: createWriterCodeMirrorExtensions({
            mode: editorMode,
            syntax: editorSyntax,
            updateListener,
            pasteHandlers,
          }),
        }),
      });

      editorViewRef.current = view;
      syncEmptyDocumentClass(valueRef.current);
      onEditorReadyRef.current?.(createEditor());

      if (shouldAutoFocusRef.current) {
        requestAnimationFrame(() =>
          focusEditor(view, initialFocusSelectionRef.current, true),
        );
      }
    },
    [
      createEditor,
      editorMode,
      editorSyntax,
      scheduleSelectionToolbarUpdate,
      scheduleSlashMenuUpdate,
      scheduleSlashMenuUpdateIfOpen,
      syncEmptyDocumentClass,
    ],
  );

  useEffect(() => {
    onEditorReadyRef.current?.(editorViewRef.current ? createEditor() : null);
    return () => onEditorReadyRef.current?.(null);
  }, [createEditor]);

  useEffect(() => {
    globalThis.document.addEventListener(
      "selectionchange",
      scheduleSelectionToolbarUpdate,
    );
    globalThis.document.addEventListener(
      "selectionchange",
      scheduleSlashMenuUpdateIfOpen,
    );
    window.addEventListener("mouseup", scheduleSelectionToolbarUpdate);
    window.addEventListener("resize", closeSelectionToolbar);
    window.addEventListener("resize", closeSlashMenu);
    window.addEventListener("scroll", scheduleSelectionToolbarUpdate, true);
    window.addEventListener("scroll", scheduleSlashMenuUpdateIfOpen, true);

    return () => {
      globalThis.document.removeEventListener(
        "selectionchange",
        scheduleSelectionToolbarUpdate,
      );
      globalThis.document.removeEventListener(
        "selectionchange",
        scheduleSlashMenuUpdateIfOpen,
      );
      window.removeEventListener("mouseup", scheduleSelectionToolbarUpdate);
      window.removeEventListener("resize", closeSelectionToolbar);
      window.removeEventListener("resize", closeSlashMenu);
      window.removeEventListener("scroll", scheduleSelectionToolbarUpdate, true);
      window.removeEventListener("scroll", scheduleSlashMenuUpdateIfOpen, true);
    };
  }, [
    closeSelectionToolbar,
    closeSlashMenu,
    scheduleSelectionToolbarUpdate,
    scheduleSlashMenuUpdateIfOpen,
  ]);

  useEffect(() => {
    return () => {
      if (slashMenuFrameRef.current !== null) {
        cancelAnimationFrame(slashMenuFrameRef.current);
      }
      if (selectionToolbarFrameRef.current !== null) {
        cancelAnimationFrame(selectionToolbarFrameRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const handleCopyOrCut = (event: ClipboardEvent) => {
      const selectedText = editorViewRef.current
        ? getSelectionMarkdown(editorViewRef.current)
        : "";
      if (!selectedText.includes(EMPTY_BLOCK_MARKER)) return;

      event.clipboardData?.setData(
        "text/plain",
        stripEmptyBlockMarkers(selectedText),
      );
      event.preventDefault();

      if (event.type === "cut") {
        replaceEditorSelection(editorViewRef.current, "");
      }
    };

    shell.addEventListener("copy", handleCopyOrCut, true);
    shell.addEventListener("cut", handleCopyOrCut, true);
    return () => {
      shell.removeEventListener("copy", handleCopyOrCut, true);
      shell.removeEventListener("cut", handleCopyOrCut, true);
    };
  }, []);

  const shellMarkdown =
    lastEpochRef.current === valueEpoch ? valueRef.current : value;

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

      const view = editorViewRef.current;
      const hasSelection = Boolean(view && !view.state.selection.main.empty);
      const items = resolveEditorContextMenuItems(
        contextMenuItems,
        hasSelection,
        disabledContextMenuCommandIds,
      );

      if (window.madinahWriter) {
        if (!hasSelection) {
          focusEditor(view, "rootEnd", true);
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
    [
      closeSelectionToolbar,
      closeSlashMenu,
      contextMenuItems,
      disabledContextMenuCommandIds,
      runContextMenuItem,
    ],
  );

  return (
    <div
      className={[
        "live-mdx-shell",
        isEditorEmptyDocument(shellMarkdown) ? "is-empty-document" : "",
        isAiOperationRunning ? "is-ai-operation-running" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={shellRef}
      onContextMenu={handleContextMenu}
      onKeyDownCapture={handleEditorKeyDown}
    >
      <div
        ref={mountEditor}
        className="post-content live-mdx-content live-mdx-editor"
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
          activeCommandId={activeAiCommandId}
          disabledCommandIds={disabledSelectionToolbarCommandIds}
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
}, areMarkdownEditorPropsEqual);

function areMarkdownEditorPropsEqual(
  previous: MarkdownEditorProps,
  next: MarkdownEditorProps,
): boolean {
  return (
    previous.documentId === next.documentId &&
    previous.documentRef === next.documentRef &&
    previous.workspaceRef === next.workspaceRef &&
    previous.editorExtensions === next.editorExtensions &&
    previous.editorMode === next.editorMode &&
    previous.commandRegistry === next.commandRegistry &&
    previous.autoFocus === next.autoFocus &&
    previous.imageUploadHandler === next.imageUploadHandler &&
    previous.contextMenuItems === next.contextMenuItems &&
    previous.isAiOperationRunning === next.isAiOperationRunning &&
    previous.activeAiCommandId === next.activeAiCommandId &&
    previous.onEditorReady === next.onEditorReady &&
    previous.onChange === next.onChange &&
    previous.onError === next.onError &&
    previous.value === next.value &&
    previous.valueEpoch === next.valueEpoch
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

function getAiCommandIdsFromContextMenuItems(
  items: readonly EditorContextMenuItem[],
): string[] {
  return items.flatMap((item) =>
    isEditorContextMenuSeparator(item) || !isAiCommandId(item.commandId)
      ? []
      : [item.commandId],
  );
}

function getAiCommandIdsFromSelectionToolbarActions(
  actions: readonly EditorSelectionToolbarAction[],
): string[] {
  return actions.flatMap((action) =>
    isAiCommandId(action.commandId) ? [action.commandId] : [],
  );
}

function isAiCommandId(commandId: string): boolean {
  return commandId.startsWith("ai.");
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
  const normalizedBody = stripLeadingBlankLines(body);

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

export function stripEmptyBlockMarkers(text: string): string {
  return text.replaceAll(EMPTY_BLOCK_MARKER, "");
}

function cleanEmptyBlockMarkers(markdown: string): string {
  return stripEmptyBlockMarkers(markdown);
}

function stripLeadingBlankLines(body: string): string {
  return body.replace(/^(?:[ \t]*\r?\n)+/, "");
}

export function normalizeEditorBody(markdown: string): string {
  return stripLeadingBlankLines(cleanEmptyBlockMarkers(markdown));
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
  range: {
    from: number;
    to: number;
  };
  atLineStart: boolean;
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

function handleEditorPaste(
  event: ClipboardEvent,
  view: EditorView,
  {
    imageUploadHandlerRef,
    onErrorRef,
  }: {
    imageUploadHandlerRef: RefObject<ImageUploadHandler | null>;
    onErrorRef: RefObject<(error: string) => void>;
  },
): boolean {
  const imageFiles = imageUploadHandlerRef.current
    ? getImageFilesFromClipboardData(event.clipboardData)
    : [];
  const text = getMarkdownTextFromClipboardData(event.clipboardData);

  if (imageFiles.length === 0 && text === null) return false;

  event.preventDefault();
  event.stopPropagation();

  if (text !== null) {
    replaceEditorSelection(view, text);
    return true;
  }

  if (imageFiles.length > 0 && imageUploadHandlerRef.current) {
    void uploadPastedImages(
      imageFiles,
      imageUploadHandlerRef.current,
      view,
      onErrorRef.current,
    );
  }
  return true;
}

async function uploadPastedImages(
  imageFiles: File[],
  imageUploadHandler: ImageUploadHandler,
  view: EditorView,
  onError: (error: string) => void,
): Promise<void> {
  for (const file of imageFiles) {
    try {
      const url = await imageUploadHandler(file);
      const altText = file.name.replace(/\.[^.]+$/, "");
      replaceEditorSelection(view, `![${altText}](${url})\n\n`);
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }
}

function createSlashWriterEditor({
  view,
  range,
}: {
  view: EditorView;
  range: { from: number; to: number };
}): WriterEditor {
  const insertAtSlashRange = (markdown: string) => {
    const inserted = prepareInsertedMarkdown(markdown);
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: inserted.markdown },
      selection: inserted.selection
        ? EditorSelection.range(
            range.from + inserted.selection.from,
            range.from + inserted.selection.to,
          )
        : EditorSelection.cursor(range.from + inserted.markdown.length),
      userEvent: "input.slashCommand",
    });
  };

  return {
    getMarkdown: () => view.state.doc.toString(),
    setMarkdown: (markdown) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: markdown },
        userEvent: "writer.setMarkdown",
      });
    },
    insertMarkdown: insertAtSlashRange,
    getSelectionMarkdown: () => "",
    replaceSelection: insertAtSlashRange,
    focus: () => focusEditor(view, undefined, true),
  };
}

function createWriterEditor({
  viewRef,
  shellRef,
  fallbackMarkdownRef,
  setMarkdown,
}: {
  viewRef: RefObject<EditorView | null>;
  shellRef: RefObject<HTMLDivElement | null>;
  fallbackMarkdownRef: RefObject<string>;
  setMarkdown: (
    markdown: string,
    selection?: "rootStart" | "rootEnd",
  ) => void;
}): WriterEditor {
  return {
    getMarkdown: () =>
      viewRef.current?.state.doc.toString() ?? fallbackMarkdownRef.current,
    setMarkdown: (markdown) => {
      fallbackMarkdownRef.current = markdown;
      shellRef.current?.classList.toggle(
        "is-empty-document",
        isEditorEmptyDocument(markdown),
      );
      setMarkdown(markdown);
    },
    insertMarkdown: (markdown) => {
      const view = viewRef.current;
      if (!view) return;
      replaceEditorSelection(view, markdown);
    },
    getSelectionMarkdown: () =>
      viewRef.current ? getSelectionMarkdown(viewRef.current) : "",
    replaceSelection: (markdown) => {
      const view = viewRef.current;
      if (!view) return;
      replaceEditorSelection(view, markdown);
    },
    focus: () => focusEditor(viewRef.current, "rootEnd", true),
  };
}

function getSlashCommandTrigger(view: EditorView): SlashCommandMenuState | null {
  const range = view.state.selection.main;
  if (!range.empty) return null;

  const line = view.state.doc.lineAt(range.head);
  const lineOffset = range.head - line.from;
  const textBeforeCaret = line.text.slice(0, lineOffset);
  const trigger = matchSlashCommandTriggerText(textBeforeCaret);
  if (!trigger) return null;

  const caretRect = view.coordsAtPos(range.head);
  if (!caretRect) return null;

  return {
    query: trigger.query,
    position: getSlashCommandPosition(
      rectLikeToDomRect(caretRect),
      SLASH_COMMAND_MENU_SIZE,
      {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    ),
    range: {
      from: line.from + trigger.slashOffset,
      to: range.head,
    },
    atLineStart: trigger.atLineStart,
    selectedIndex: 0,
  };
}

function getEditorSelectionRect(
  view: EditorView,
  from: number,
  to: number,
): DOMRect | null {
  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  if (!start && !end) return null;
  if (!start) return end ? rectLikeToDomRect(end) : null;
  if (!end) return rectLikeToDomRect(start);

  return new DOMRect(
    Math.min(start.left, end.left),
    Math.min(start.top, end.top),
    Math.max(1, Math.abs(end.right - start.left)),
    Math.max(start.bottom - start.top, end.bottom - end.top),
  );
}

function rectLikeToDomRect(rect: {
  left: number;
  right: number;
  top: number;
  bottom: number;
}): DOMRect {
  return new DOMRect(
    rect.left,
    rect.top,
    Math.max(1, rect.right - rect.left),
    Math.max(1, rect.bottom - rect.top),
  );
}

function getSelectionMarkdown(view: EditorView): string {
  const range = view.state.selection.main;
  if (range.empty) return "";
  return view.state.sliceDoc(range.from, range.to);
}

function replaceEditorSelection(view: EditorView | null, markdown: string) {
  if (!view) return;

  const range = view.state.selection.main;
  const inserted = prepareInsertedMarkdown(markdown);
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: inserted.markdown },
    selection: inserted.selection
      ? EditorSelection.range(
          range.from + inserted.selection.from,
          range.from + inserted.selection.to,
        )
      : EditorSelection.cursor(range.from + inserted.markdown.length),
    userEvent: "input.insertMarkdown",
  });
}

function prepareInsertedMarkdown(markdown: string): {
  markdown: string;
  selection: { from: number; to: number } | null;
} {
  const first = markdown.indexOf(EMPTY_BLOCK_MARKER);
  const second =
    first >= 0 ? markdown.indexOf(EMPTY_BLOCK_MARKER, first + 1) : -1;
  const clean = cleanEmptyBlockMarkers(markdown);

  if (first < 0 || second < 0) {
    return { markdown: clean, selection: null };
  }

  return {
    markdown: clean,
    selection: {
      from: first,
      to: Math.max(first, second - EMPTY_BLOCK_MARKER.length),
    },
  };
}

function focusEditor(
  view: EditorView | null,
  selection?: "rootStart" | "rootEnd",
  preventScroll = false,
) {
  if (!view) return;

  if (selection) {
    view.dispatch({
      selection: EditorSelection.cursor(
        selection === "rootStart" ? 0 : view.state.doc.length,
      ),
      scrollIntoView: !preventScroll,
    });
  }

  view.focus();
}

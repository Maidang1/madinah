import {
  MDXEditor,
  imagePlugin,
  type ImageUploadHandler,
  type MDXEditorMethods,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import {
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  memo,
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
import { getWrappedSelection, isWrappingKey } from "./wrap-selection";
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
  isInlineSlashCommandId,
  matchSlashCommandTriggerText,
  replaceSlashTriggerInMarkdown,
  searchSlashCommandItems,
  type SlashCommandItem,
  type SlashCommandPosition,
} from "./slash-commands";

const EMPTY_DISABLED_COMMAND_IDS: readonly string[] = [];

interface MarkdownEditorProps {
  value: string;
  // Bumped by the session only when `value` reflects an EXTERNAL content change
  // (open file / restore / revert). Unchanged across user keystrokes, so the
  // reset effect can distinguish self-edits (never reset) from external swaps
  // (reset the editor). See DocumentSession.contentEpoch.
  valueEpoch: number;
  documentId: string | null;
  documentRef: RefObject<MarkdownDocument | null>;
  workspaceRef: RefObject<WorkspaceInfo | null>;
  editorPlugins: unknown[];
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
  editorPlugins,
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
  const editorRef = useRef<MDXEditorMethods>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  // Keep the latest markdown readable from stable callbacks without making
  // them (and the effects that depend on them) re-run on every keystroke.
  const valueRef = useRef(value);
  const lastEpochRef = useRef(valueEpoch);
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
  slashMenuRef.current = slashMenu;
  const selectionToolbarRef = useRef<EditorSelectionToolbarState | null>(null);
  selectionToolbarRef.current = selectionToolbar;
  const slashMenuFrameRef = useRef<number | null>(null);
  const selectionToolbarFrameRef = useRef<number | null>(null);
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
  const resolvedEditorPlugins = useMemo(
    () => [
      ...editorPlugins,
      imagePlugin({ imageUploadHandler }),
      createSourceModeEditorPlugin(editorMode),
    ],
    [editorMode, editorPlugins, imageUploadHandler],
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
  const restoreEditorFocus = useCallback(() => {
    requestAnimationFrame(() =>
      editorRef.current?.focus(undefined, {
        defaultSelection: "rootEnd",
        preventScroll: true,
      }),
    );
  }, []);
  const syncEmptyDocumentClass = useCallback((markdown: string) => {
    shellRef.current?.classList.toggle(
      "is-empty-document",
      isEditorEmptyDocument(markdown),
    );
  }, []);

  // Reset the (uncontrolled) editor content ONLY on an external content change,
  // signalled by a bumped `valueEpoch`. User keystrokes flow out via onChange and
  // come back as a new `value` with the SAME epoch — we deliberately ignore those,
  // so we never call setMarkdown mid-typing (which would clear the Lexical root and
  // send the caret to the document start). This sidesteps the impedance mismatch
  // between our compose/split-normalized `value` and MDXEditor's own re-serialized
  // getMarkdown() output, which can never be byte-equal.
  useEffect(() => {
    valueRef.current = value;
    if (lastEpochRef.current === valueEpoch) return;
    lastEpochRef.current = valueEpoch;

    // External swap. Skip the reset if the editor already shows this content
    // (e.g. reverting to what's on screen), comparing with MDXEditor's own trim
    // semantics to avoid a needless caret-resetting setMarkdown.
    const current = editorRef.current?.getMarkdown() ?? "";
    if (current.trim() === value.trim()) return;

    editorRef.current?.setMarkdown(value);
    syncEmptyDocumentClass(value);
  }, [syncEmptyDocumentClass, value, valueEpoch]);

  useEffect(() => {
    if (!onEditorReady) return;

    onEditorReady(createWriterEditor(editorRef, shellRef, valueRef));
    return () => onEditorReady(null);
  }, [onEditorReady]);

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
          document: documentRef.current,
          editor: createWriterEditor(editorRef, shellRef, valueRef),
          workspace: workspaceRef.current,
        });
        restoreEditorFocus();
      } catch (error: unknown) {
        onError(error instanceof Error ? error.message : String(error));
      }
    },
    [
      closeContextMenu,
      commandRegistry,
      documentRef,
      onError,
      restoreEditorFocus,
      workspaceRef,
    ],
  );

  const runSelectionToolbarAction = useCallback(
    async (action: EditorSelectionToolbarAction) => {
      if (isAiOperationRunning && isAiCommandId(action.commandId)) return;

      const editor = createWriterEditor(editorRef, shellRef, valueRef);
      closeSelectionToolbar();

      try {
        await commandRegistry.execute(action.commandId, {
          document: documentRef.current,
          editor,
          workspace: workspaceRef.current,
        });
        editor.focus?.();
      } catch (error: unknown) {
        onError(error instanceof Error ? error.message : String(error));
      }
    },
    [
      closeSelectionToolbar,
      commandRegistry,
      documentRef,
      isAiOperationRunning,
      onError,
      workspaceRef,
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
      atLineStart: trigger.atLineStart,
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

  const handleEditorInput = useCallback(
    (event: ReactFormEvent<HTMLDivElement>) => {
      if (!slashMenuRef.current && !inputEventMayOpenSlashMenu(event.nativeEvent)) {
        return;
      }

      scheduleSlashMenuUpdate();
    },
    [scheduleSlashMenuUpdate],
  );

  const runSlashCommand = useCallback(
    async (item: SlashCommandItem) => {
      const activeSlashMenu = slashMenu;
      if (!activeSlashMenu) return;

      closeSlashMenu();
      closeSelectionToolbar();

      const editor = createSlashWriterEditor(
        editorRef,
        valueRef,
        activeSlashMenu.triggerText,
        activeSlashMenu.atLineStart,
        onChange,
      );

      try {
        await commandRegistry.execute(item.command.id, {
          document: documentRef.current,
          editor,
          workspace: workspaceRef.current,
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
      documentRef,
      onChange,
      onError,
      slashMenu,
      workspaceRef,
    ],
  );

  const handleEditorKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      // Wrap the current selection when a paired symbol is typed over it.
      // Only in rich-text mode (CodeMirror handles its own bracket matching in
      // source mode) and only for a bare keypress with no modifiers.
      if (
        editorMode === "rich-text" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        isWrappingKey(event.key)
      ) {
        const selection = window.getSelection();
        const range = getSelectionRangeInside(shellRef.current, selection);
        if (range && selection) {
          const wrapped = getWrappedSelection(event.key, selection.toString());
          if (wrapped) {
            event.preventDefault();
            event.stopPropagation();
            // execCommand("insertText") routes through Lexical's beforeinput
            // handling, so the wrap lands as plain text and stays on the
            // native undo stack. (`document` here is the component prop, so use
            // the global explicitly.)
            window.document.execCommand("insertText", false, wrapped.text);
            return;
          }
        }
      }

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
    [closeSlashMenu, editorMode, runSlashCommand, slashCommandResults, slashMenu],
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

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    // Editable placeholders use a zero-width marker; strip it from copied /
    // cut text so it never leaks invisible characters into other apps.
    const handleCopyOrCut = (event: ClipboardEvent) => {
      const selectedText = window.getSelection()?.toString() ?? "";
      if (!selectedText.includes(EMPTY_BLOCK_MARKER)) return;

      event.clipboardData?.setData(
        "text/plain",
        stripEmptyBlockMarkers(selectedText),
      );
      event.preventDefault();

      // preventDefault also cancels the native cut deletion, so remove the
      // selection ourselves to preserve cut semantics.
      if (event.type === "cut") {
        globalThis.document.execCommand?.("delete");
      }
    };

    shell.addEventListener("copy", handleCopyOrCut, true);
    shell.addEventListener("cut", handleCopyOrCut, true);
    return () => {
      shell.removeEventListener("copy", handleCopyOrCut, true);
      shell.removeEventListener("cut", handleCopyOrCut, true);
    };
  }, []);

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
    const selection = window.getSelection();
    if (
      !selectionToolbarRef.current &&
      (!selection || selection.rangeCount === 0 || selection.isCollapsed)
    ) {
      return;
    }
    if (selectionToolbarFrameRef.current !== null) return;

    selectionToolbarFrameRef.current = requestAnimationFrame(() => {
      selectionToolbarFrameRef.current = null;
      updateSelectionToolbar();
    });
  }, [updateSelectionToolbar]);

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
    // Reposition (instead of closing) on scroll so the toolbar / slash menu
    // follow the caret; updateSelectionToolbar/updateSlashMenu clear themselves
    // when the selection or trigger is gone.
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

  // On an external content change (epoch bumped) the incoming `value` is the
  // authority until the reset effect runs; otherwise the live edited content in
  // `valueRef` is freshest (updated from onChange between renders).
  const shellMarkdown =
    lastEpochRef.current === valueEpoch ? valueRef.current : value;

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
        disabledContextMenuCommandIds,
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
      onInput={handleEditorInput}
      onKeyDownCapture={handleEditorKeyDown}
    >
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={(markdown, initialMarkdownNormalize) => {
          if (initialMarkdownNormalize) return;
          const nextMarkdown = cleanEmptyBlockMarkers(markdown);
          valueRef.current = nextMarkdown;
          syncEmptyDocumentClass(nextMarkdown);
          onChange(nextMarkdown);
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
  // Pure render optimization. Correctness of content resets no longer depends
  // on this guard — the reset effect keys off `valueEpoch`, so even if a
  // self-edit re-renders the component, it will not reset the editor.
  return (
    previous.documentId === next.documentId &&
    previous.documentRef === next.documentRef &&
    previous.workspaceRef === next.workspaceRef &&
    previous.editorPlugins === next.editorPlugins &&
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

// Strip leading blank lines from a body. `composeDocumentEditorMarkdown` applies
// this when joining title + body, so the body that flows back into the editor is
// normalized this way. The editor's own live content must be normalized the same
// way before comparing, otherwise the value guard sees raw-vs-normalized drift
// and needlessly resets the editor (moving the caret to the start).
function stripLeadingBlankLines(body: string): string {
  return body.replace(/^(?:[ \t]*\r?\n)+/, "");
}

// Normalize the editor's live markdown into the same shape as the `value` prop
// (which is derived via compose→split). Used to decide whether an incoming
// `value` actually differs from what the editor already shows.
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

function inputEventMayOpenSlashMenu(event: Event): boolean {
  const inputEvent = event as InputEvent;
  return typeof inputEvent.data === "string" && inputEvent.data.includes("/");
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

function createSlashWriterEditor(
  editorRef: RefObject<MDXEditorMethods | null>,
  fallbackMarkdownRef: RefObject<string>,
  triggerText: string,
  atLineStart: boolean,
  onChange: (value: string) => void,
): WriterEditor {
  const insertAtSlashRange = (markdown: string) => {
    const currentMarkdown =
      editorRef.current?.getMarkdown() ?? fallbackMarkdownRef.current;
    const nextMarkdown = replaceSlashTriggerInMarkdown(
      currentMarkdown,
      triggerText,
      markdown,
      atLineStart,
    );
    fallbackMarkdownRef.current = nextMarkdown;
    editorRef.current?.setMarkdown(nextMarkdown);
    onChange(cleanEmptyBlockMarkers(nextMarkdown));
  };

  return {
    getMarkdown: () =>
      editorRef.current?.getMarkdown() ?? fallbackMarkdownRef.current,
    setMarkdown: (markdown) => {
      fallbackMarkdownRef.current = markdown;
      editorRef.current?.setMarkdown(markdown);
    },
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
  fallbackMarkdownRef: RefObject<string>,
): WriterEditor {
  return {
    getMarkdown: () =>
      editorRef.current?.getMarkdown() ?? fallbackMarkdownRef.current,
    setMarkdown: (markdown) => {
      fallbackMarkdownRef.current = markdown;
      shellRef.current?.classList.toggle(
        "is-empty-document",
        isEditorEmptyDocument(markdown),
      );
      editorRef.current?.setMarkdown(markdown);
    },
    insertMarkdown: (markdown) => editorRef.current?.insertMarkdown(markdown),
    // Use MDXEditor's own selection API so formatting commands operate on the
    // parsed markdown of the selection. insertMarkdown parses and replaces the
    // active selection, so "**text**" becomes real bold rather than literal
    // asterisks (which is what the DOM execCommand path produced).
    getSelectionMarkdown: () =>
      editorRef.current?.getSelectionMarkdown() ??
      getSelectedTextInside(shellRef.current),
    replaceSelection: (markdown) => editorRef.current?.insertMarkdown(markdown),
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
    atLineStart: trigger.atLineStart,
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

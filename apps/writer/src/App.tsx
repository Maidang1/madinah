import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  lazy,
  memo,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  CaseSensitive,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileCode2,
  FolderOpen,
  Folder,
  Moon,
  PanelLeft,
  PanelRight,
  PencilLine,
  Replace,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import type { TreeApi } from "react-arborist";
import type {
  AcpAgentRuntimeConfig,
  AiDocumentReviewState,
  AiOperationState,
} from "./domain/ai-polish";
import { EMPTY_AI_OPERATION_STATE } from "./domain/ai-polish";
import {
  createDefaultAssetUploadSettings,
  type AssetUploadSettings,
} from "./domain/assets";
import type {
  ResolvedPlugin,
  WriterEditor,
  WorkspaceInfo,
} from "./domain/engine";
import type { MarkdownDocument } from "./domain/document";
import {
  getDocumentSourceFilePath,
  isDraftDocumentSource,
} from "./domain/document-source";
import { getWriterKeyboardShortcutAction } from "./features/commands/keyboard-shortcuts";
import {
  getWriterCommandIdFromPayload,
} from "./features/commands/native-menu";
import { useWriterCommands } from "./features/commands/useWriterCommands";
const CommandPalette = lazy(() =>
  import("./features/commands/command-palette").then((mod) => ({
    default: mod.CommandPalette,
  })),
);
import { PLUGIN_DIAGNOSTICS_PANEL_ID } from "./features/engine/PluginDiagnostics";
import {
  AI_GENERATE_METADATA_COMMAND_ID,
  AI_REVIEW_DOCUMENT_COMMAND_ID,
  AI_REWRITE_SELECTION_COMMAND_ID,
  EMPTY_AI_REVIEW_STATE,
} from "./features/ai-polish/command";
import { AiOperationBanner } from "./features/ai-polish/AiOperationBanner";
import {
  loadAcpSettings,
  saveAcpSettings as persistAcpSettings,
  type AcpSettings,
} from "./features/ai-polish/settings";
import { createImageUploadHandler } from "./features/assets/image-upload";
import {
  composeDocumentEditorMarkdown,
  DOCUMENT_TITLE_PLACEHOLDER,
  getEditableEmptyDocumentMarkdown,
  getDocumentEditorTitle,
  MarkdownEditor,
  shouldAutoFocusDocumentTitle,
  splitDocumentEditorMarkdown,
  shouldShowDocumentStartState,
} from "./features/editor/MarkdownEditor";
import { getMarkdownTextFromClipboardData } from "./features/editor/clipboard";
import type { EditorContextMenuItem } from "./features/editor/editor-context-menu";
import { EngineProvider, useEngine } from "./features/engine/EngineProvider";
import { loadTrustedWorkspacePlugins } from "./features/engine/workspace-loader";
import { FileTreeSidebar } from "./features/file-tree/FileTreeSidebar";
import {
  addFileTreeRoot,
  buildPublishFilePath,
  buildFileTreeRootNodes,
  findFileTreeRootForPath,
  type FileTreeDraftAction,
  type FileTreeDraftItem,
  type FileTreeMenuAction,
  type FileTreeNode,
  getActiveFileTreeRoot,
  getFileTreeStatus,
  isPathOnlyCoveredByFileTreeRoot,
  pathContains,
  parseFileTreeRoots,
  removeFileTreeRoot,
  resolvePublishTarget,
  serializeFileTreeRoots,
  toRelativePath,
} from "./features/file-tree/file-tree";
import {
  markSelfWrittenFilePath,
  shouldIgnoreSelfWrittenFileTreeChange,
} from "./features/file-tree/self-write-guard";
import {
  createDocumentVersion,
  documentFromVersion,
  getVersionTargetId,
  type DocumentVersion,
} from "./features/history/document-history";
import { createLocalDocumentHistoryStore } from "./features/history/local-document-history";
import {
  buildQuickOpenItems,
  searchQuickOpenItems,
  type QuickOpenItem,
} from "./features/search/document-search";
import {
  clearActiveDocumentSearchMatch,
  findDocumentMatches,
  getAdjacentMatchIndex,
  replaceAllInSource,
  replaceNthInSource,
  scrollActiveDocumentSearchMatchIntoView,
  type DocumentSearchMatch,
} from "./features/search/in-document-search";
import { DocumentInspector } from "./features/inspector/DocumentInspector";
const PreviewPane = lazy(() =>
  import("./features/preview/PreviewPane").then((mod) => ({
    default: mod.PreviewPane,
  })),
);
import { confirmPublishOverwrite } from "./features/session/publish-document";
import { SaveStatusIndicator } from "./features/session/SaveStatusIndicator";
import { useDocumentSession } from "./features/session/useDocumentSession";
import type { SettingsCheckState } from "./features/settings/WriterSettingsDialog";
const WriterSettingsDialog = lazy(() =>
  import("./features/settings/WriterSettingsDialog").then((mod) => ({
    default: mod.WriterSettingsDialog,
  })),
);
import { ViewModeControl } from "./features/workbench/ViewModeControl";
import { useWriterOverlays } from "./features/workbench/useWriterOverlays";
import {
  getInitialWorkbenchState,
  persistWorkbenchState,
  shouldRestoreEditorFocus,
  workbenchStateReducer,
} from "./features/workbench/workbench-state";
import {
  clampWorkbenchPaneWidth,
  getInitialWorkbenchPaneWidths,
  getKeyboardWorkbenchPaneWidth,
  getResizedWorkbenchPaneWidth,
  persistWorkbenchPaneWidth,
  WORKBENCH_PANE_WIDTH_BOUNDS,
  type WorkbenchPane,
} from "./features/workbench/workbench-layout";
import {
  buildFileTreeDraftItems,
  buildSidebarTree,
  collectFolderIds,
  formatWordCount,
  getDocumentMetrics,
  mergeActiveDocument,
  type SidebarTreeNode,
} from "./features/workbench/document-summary";
import type { TocItem } from "./lib/toc";
import { useDebouncedValue } from "./lib/use-debounced-value";
import {
  createPlatformAdapters,
  type PlatformAdapters,
} from "./platform";

const THEME_STORAGE_KEY = "madinah-writer-theme";
const THEME_STORAGE_VERSION_KEY = "madinah-writer-theme-version";
const THEME_STORAGE_VERSION = "2";
const COMMANDS_THAT_OPEN_OVERLAYS = new Set([
  "document.search",
  "view.commandPalette",
  "view.quickOpen",
]);
const FILE_TREE_ROOTS_STORAGE_KEY = "madinah-writer-file-tree-roots";
const LEGACY_FILE_TREE_ROOT_STORAGE_KEY = "madinah-writer-file-tree-root";
const PUBLISH_TARGET_STORAGE_KEY = "madinah-writer-publish-target";
const EDITOR_CONTEXT_MENU_ITEMS: EditorContextMenuItem[] = [
  {
    id: "ai-rewrite-selection",
    label: "Rewrite Selection",
    commandId: AI_REWRITE_SELECTION_COMMAND_ID,
    requiresSelection: true,
  },
  {
    id: "ai-generate-metadata",
    label: "Generate Metadata",
    commandId: AI_GENERATE_METADATA_COMMAND_ID,
  },
  {
    id: "ai-review-document",
    label: "Review Document",
    commandId: AI_REVIEW_DOCUMENT_COMMAND_ID,
  },
  {
    id: "format-separator",
    type: "separator",
  },
  {
    id: "bold",
    label: "Bold",
    commandId: "editor.format.bold",
    requiresSelection: true,
  },
  {
    id: "italic",
    label: "Italic",
    commandId: "editor.format.italic",
    requiresSelection: true,
  },
  {
    id: "link",
    label: "Link",
    commandId: "editor.format.link",
    requiresSelection: true,
  },
  {
    id: "inline-code",
    label: "Inline Code",
    commandId: "editor.format.inlineCode",
    requiresSelection: true,
  },
];
const EMPTY_EDITOR_PLUGINS: unknown[] = [];

type WriterTheme = "dark" | "light";

function useStableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
): (...args: Args) => Result {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: Args) => callbackRef.current(...args), []);
}

export default function App() {
  const platform = useMemo(() => createPlatformAdapters(), []);

  return (
    <EngineProvider>
      <WriterSurface platform={platform} />
    </EngineProvider>
  );
}

function WriterSurface({ platform }: { platform: PlatformAdapters }) {
  const engine = useEngine();
  const selfWrittenFilePathsRef = useRef(new Map<string, number>());
  const markSelfWrittenPath = useCallback((filePath: string) => {
    markSelfWrittenFilePath(selfWrittenFilePathsRef.current, filePath);
  }, []);
  const shouldSkipFileTreeRefresh = useCallback((changedPath?: string) => {
    return shouldIgnoreSelfWrittenFileTreeChange(
      selfWrittenFilePathsRef.current,
      changedPath,
    );
  }, []);
  const documentPlatform = useMemo<PlatformAdapters>(
    () => ({
      ...platform,
      fileStore: {
        ...platform.fileStore,
        writeMarkdownFile: async (path, source) => {
          const file = await platform.fileStore.writeMarkdownFile(path, source);
          markSelfWrittenPath(path);
          return file;
        },
      },
    }),
    [markSelfWrittenPath, platform],
  );
  const {
    session,
    documents,
    status,
    changeSource,
    changeMetadata,
    restoreDocument,
    openFromDialog,
    openStoredDocument,
    openMarkdownPath,
    createNewDocument,
    importBlogDocuments,
    publishStoredDocument,
    updateStoredDocumentStatus,
    deleteStoredDocument,
    saveNow,
    revert,
    close,
    setStatus,
  } = useDocumentSession(documentPlatform, engine.activateWorkspacePlugins);
  const sessionDocumentRef = useRef<MarkdownDocument | null>(null);
  sessionDocumentRef.current = session.document;
  const sessionWorkspaceRef = useRef<WorkspaceInfo | null>(null);
  sessionWorkspaceRef.current = session.workspace;
  const deferredDocument = useDeferredValue(session.document);
  const derivedDocument =
    session.document && deferredDocument?.id === session.document.id
      ? deferredDocument
      : session.document;
  const activeDocumentFilePath = getDocumentSourceFilePath(session.source);
  const isActiveDraftDocument = isDraftDocumentSource(session.source);
  const [, startDocumentChangeTransition] = useTransition();
  const visibleDocuments = useMemo(
    () => mergeActiveDocument(documents, derivedDocument),
    [derivedDocument, documents],
  );
  const draftDocuments = useMemo(
    () => mergeActiveDocument(documents, isActiveDraftDocument ? derivedDocument : null),
    [derivedDocument, documents, isActiveDraftDocument],
  );
  const sidebarDrafts = useMemo(
    () => buildFileTreeDraftItems(draftDocuments),
    [draftDocuments],
  );
  const sidebarTree = useMemo(
    () => buildSidebarTree(visibleDocuments),
    [visibleDocuments],
  );
  const folderIds = useMemo(() => collectFolderIds(sidebarTree), [sidebarTree]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(["root"]),
  );
  const [fileTreeRoots, setFileTreeRoots] = useState<string[]>(() =>
    parseFileTreeRoots(
      window.localStorage.getItem(FILE_TREE_ROOTS_STORAGE_KEY),
      window.localStorage.getItem(LEGACY_FILE_TREE_ROOT_STORAGE_KEY),
    ),
  );
  const [fileTreeNodesByRoot, setFileTreeNodesByRoot] = useState<
    Record<string, FileTreeNode[]>
  >({});
  const [fileTreeStatusByRoot, setFileTreeStatusByRoot] = useState<
    Record<string, string>
  >({});
  const [expandedFileTreePaths, setExpandedFileTreePaths] = useState<Set<string>>(
    () => new Set(fileTreeRoots),
  );
  const activeFileTreeRoot = useMemo(
    () => getActiveFileTreeRoot(fileTreeRoots, activeDocumentFilePath),
    [activeDocumentFilePath, fileTreeRoots],
  );
  const [publishTargetPath, setPublishTargetPath] = useState<string | null>(
    () => window.localStorage.getItem(PUBLISH_TARGET_STORAGE_KEY),
  );
  const publishTarget = useMemo(
    () =>
      resolvePublishTarget({
        explicitTargetPath: publishTargetPath,
        activePath: activeDocumentFilePath,
        activeRoot: activeFileTreeRoot,
      }),
    [activeDocumentFilePath, activeFileTreeRoot, publishTargetPath],
  );
  const fileTreeNodes = useMemo(
    () =>
      buildFileTreeRootNodes(
        fileTreeRoots.map((root) => ({
          path: root,
          nodes: fileTreeNodesByRoot[root] ?? [],
        })),
      ),
    [fileTreeNodesByRoot, fileTreeRoots],
  );
  const fileTreeStatus = useMemo(
    () =>
      getFileTreeStatus(
        fileTreeRoots,
        fileTreeStatusByRoot,
        platform.fileTreeStore.isAvailable,
      ),
    [fileTreeRoots, fileTreeStatusByRoot, platform.fileTreeStore.isAvailable],
  );
  const fileTreeRef = useRef<TreeApi<FileTreeNode> | null>(null);
  const activeEditorRef = useRef<WriterEditor | null>(null);
  const showsFileDetails = true;
  const [workbenchState, dispatchWorkbenchState] = useReducer(
    workbenchStateReducer,
    undefined,
    () => getInitialWorkbenchState(window.localStorage),
  );
  const {
    viewMode,
    editorMode,
    inspectorTab,
    isSidebarVisible,
    isInspectorVisible,
    isFocusMode,
    isTypewriterMode,
  } = workbenchState;
  const [paneWidths, setPaneWidths] = useState(() =>
    getInitialWorkbenchPaneWidths(window.localStorage),
  );
  const paneResizeCleanupRef = useRef<(() => void) | null>(null);
  const previousViewModeRef = useRef(viewMode);
  const [startedEmptyDocumentId, setStartedEmptyDocumentId] = useState<
    string | null
  >(null);
  const [theme, setTheme] = useState<WriterTheme>(getInitialTheme);
  const [acpSettings, setAcpSettings] = useState<AcpSettings>(loadAcpSettings);
  const [assetSettings, setAssetSettings] = useState<AssetUploadSettings>(
    createDefaultAssetUploadSettings,
  );
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const historyStore = useMemo(() => createLocalDocumentHistoryStore(), []);
  const [aiReviewState, setAiReviewState] = useState<AiDocumentReviewState>(
    EMPTY_AI_REVIEW_STATE,
  );
  const [aiOperationState, setAiOperationState] =
    useState<AiOperationState>(EMPTY_AI_OPERATION_STATE);
  const [acpCheckState, setAcpCheckState] = useState<SettingsCheckState>({
    status: "idle",
    message: "Ready",
  });
  const [assetCheckState, setAssetCheckState] = useState<SettingsCheckState>({
    status: "idle",
    message: "Ready",
  });
  const [workspacePlugins, setWorkspacePlugins] = useState<ResolvedPlugin[]>([]);
  const [workspacePluginCheckState, setWorkspacePluginCheckState] =
    useState<SettingsCheckState>({
      status: "idle",
      message: "Open a workspace file to inspect plugins",
    });
  const restoreEditorFocus = useCallback(() => {
    requestAnimationFrame(() => {
      activeEditorRef.current?.focus?.();
    });
  }, []);
  const {
    isQuickOpenOpen,
    setIsQuickOpenOpen,
    quickOpenQuery,
    setQuickOpenQuery,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    commandPaletteQuery,
    setCommandPaletteQuery,
    isDocumentSearchOpen,
    setIsDocumentSearchOpen,
    documentSearchQuery,
    setDocumentSearchQuery,
    activeSearchIndex,
    setActiveSearchIndex,
    isReplaceVisible,
    setIsReplaceVisible,
    documentReplaceQuery,
    setDocumentReplaceQuery,
    isSearchCaseSensitive,
    setIsSearchCaseSensitive,
    isSettingsOpen,
    setIsSettingsOpen,
    closeCommandPalette,
    closeDocumentSearch,
    closeQuickOpen,
    closeSettings,
  } = useWriterOverlays({
    restoreEditorFocus,
    clearDocumentSearchHighlight,
  });
  const workbenchLayoutStyle = useMemo(
    () =>
      ({
        "--writer-sidebar-width": `${paneWidths.sidebar}px`,
        "--writer-inspector-width": `${paneWidths.inspector}px`,
      }) as CSSProperties,
    [paneWidths],
  );
  const setWorkbenchPaneWidth = useCallback(
    (pane: WorkbenchPane, width: number) => {
      setPaneWidths((current) => {
        const nextWidth = clampWorkbenchPaneWidth(pane, width);
        if (current[pane] === nextWidth) return current;
        return {
          ...current,
          [pane]: nextWidth,
        };
      });
      persistWorkbenchPaneWidth(pane, width, window.localStorage);
    },
    [],
  );
  const beginPaneResize = useCallback(
    (pane: WorkbenchPane, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;

      event.preventDefault();
      paneResizeCleanupRef.current?.();

      const startClientX = event.clientX;
      const startWidth = paneWidths[pane];
      const resizeTarget = event.currentTarget;
      try {
        resizeTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can fail if the pointer is already released.
      }
      document.body.classList.add("is-resizing-writer-pane");

      const handlePointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        setWorkbenchPaneWidth(
          pane,
          getResizedWorkbenchPaneWidth({
            currentClientX: moveEvent.clientX,
            pane,
            startClientX,
            startWidth,
          }),
        );
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
        try {
          if (resizeTarget.hasPointerCapture(event.pointerId)) {
            resizeTarget.releasePointerCapture(event.pointerId);
          }
        } catch {
          // The element can be gone after a layout visibility change.
        }
        document.body.classList.remove("is-resizing-writer-pane");
        paneResizeCleanupRef.current = null;
      };

      paneResizeCleanupRef.current = cleanup;
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
    },
    [paneWidths, setWorkbenchPaneWidth],
  );
  const handlePaneResizeKeyDown = useCallback(
    (pane: WorkbenchPane, event: ReactKeyboardEvent<HTMLElement>) => {
      const nextWidth = getKeyboardWorkbenchPaneWidth({
        currentWidth: paneWidths[pane],
        key: event.key,
        pane,
      });
      if (nextWidth === null) return;

      event.preventDefault();
      setWorkbenchPaneWidth(pane, nextWidth);
    },
    [paneWidths, setWorkbenchPaneWidth],
  );
  useEffect(() => {
    return () => {
      paneResizeCleanupRef.current?.();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;

    platform.assetUpload
      .loadSettings()
      .then((settings) => {
        if (!cancelled) {
          setAssetSettings(settings);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAssetCheckState({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [platform.assetUpload]);
  useEffect(() => {
    setAiReviewState(EMPTY_AI_REVIEW_STATE);
  }, [session.document?.id]);
  // Word-count style metrics don't need keystroke-level accuracy; trail the
  // body so the regex passes stay off the typing hot path.
  const debouncedDocumentBody = useDebouncedValue(
    session.document?.body ?? "",
    300,
  );
  const metrics = useMemo(
    () => getDocumentMetrics(debouncedDocumentBody),
    [debouncedDocumentBody],
  );
  const documentEditor = useMemo(() => {
    if (!session.document) return null;

    const parts = splitDocumentEditorMarkdown(session.document.body);
    return {
      body: parts.body,
      title: getDocumentEditorTitle(
        session.document.body,
        session.document.title,
      ),
    };
  }, [session.document]);
  // Building the quick-open index walks every document body; only pay for it
  // while the dialog is open instead of on every keystroke in the editor.
  const quickOpenItems = useMemo(
    () =>
      isQuickOpenOpen
        ? buildQuickOpenItems({
            documents: visibleDocuments,
            fileTreeNodes,
          })
        : [],
    [fileTreeNodes, isQuickOpenOpen, visibleDocuments],
  );
  const quickOpenResults = useMemo(
    () => searchQuickOpenItems(quickOpenItems, quickOpenQuery).slice(0, 12),
    [quickOpenItems, quickOpenQuery],
  );
  const documentSearchMatches = useMemo(
    () =>
      isDocumentSearchOpen
        ? findDocumentMatches(documentEditor?.body ?? "", documentSearchQuery, {
            limit: 500,
            caseSensitive: isSearchCaseSensitive,
          })
        : [],
    [
      documentEditor?.body,
      documentSearchQuery,
      isDocumentSearchOpen,
      isSearchCaseSensitive,
    ],
  );
  const historyTargetId = session.document
    ? getVersionTargetId(session.document, activeDocumentFilePath)
    : null;
  const isDocumentStartStateVisible = session.document
    ? shouldShowDocumentStartState(
        session.document.body,
        startedEmptyDocumentId === session.document.id,
      )
    : false;
  const startEditingEmptyDocument = useCallback(() => {
    if (!session.document) return;

    setStartedEmptyDocumentId(session.document.id);
    const editableMarkdown = getEditableEmptyDocumentMarkdown(
      session.document.body,
    );
    if (editableMarkdown !== session.document.body) {
      changeSource(editableMarkdown);
    }
  }, [changeSource, session.document]);
  const pasteMarkdownIntoEmptyDocument = useCallback(
    (markdown: string) => {
      if (!session.document) return;

      setStartedEmptyDocumentId(session.document.id);
      changeSource(markdown);
    },
    [changeSource, session.document],
  );
  const changeDocumentTitle = useCallback(
    (title: string) => {
      if (!session.document || !documentEditor) return;

      const nextSource = composeDocumentEditorMarkdown(title, documentEditor.body);
      const nextMetadataTitle = title.trim() || "Untitled";

      if (nextSource !== session.document.body) {
        changeSource(nextSource);
      }
      if (nextMetadataTitle !== session.document.title) {
        changeMetadata({ title: nextMetadataTitle });
      }
    },
    [changeMetadata, changeSource, documentEditor, session.document],
  );
  const changeDocumentBody = useCallback(
    (body: string) => {
      if (!session.document || !documentEditor) return;

      const nextSource = composeDocumentEditorMarkdown(documentEditor.title, body);
      if (nextSource === session.document.body) return;

      startDocumentChangeTransition(() => {
        changeSource(nextSource);
      });
    },
    [
      changeSource,
      documentEditor,
      session.document,
      startDocumentChangeTransition,
    ],
  );
  const handleEditorBodyChange = useStableCallback((body: string) => {
    changeDocumentBody(body);
  });
  const handleEditorReady = useCallback((editor: WriterEditor | null) => {
    activeEditorRef.current = editor;
  }, []);
  const handleEditorError = useCallback(
    (error: string) => setStatus(error),
    [setStatus],
  );
  const saveCurrentVersion = useCallback(
    (reason = "Manual snapshot") => {
      if (!session.document || !historyTargetId) return;

      const nextVersions = historyStore.save(
        createDocumentVersion({
          targetId: historyTargetId,
          document: session.document,
          reason,
        }),
      );
      setVersions(nextVersions);
      setStatus("Version saved");
    },
    [historyStore, historyTargetId, session.document, setStatus],
  );
  const showAiReview = useCallback(() => {
    dispatchWorkbenchState({ type: "showInspectorTab", tab: "review" });
  }, []);
  useEffect(() => {
    if (
      aiOperationState.status === "idle" ||
      aiOperationState.status === "running"
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setAiOperationState(EMPTY_AI_OPERATION_STATE);
    }, 2400);
    return () => window.clearTimeout(timeout);
  }, [aiOperationState]);
  const imageUploadHandler = useMemo(
    () =>
      createImageUploadHandler({
        assetUpload: platform.assetUpload,
        settings: assetSettings,
        setStatus,
      }),
    [assetSettings, platform.assetUpload, setStatus],
  );
  const showWorkspaceDiagnostics = useCallback(() => {
    dispatchWorkbenchState({ type: "showInspectorTab", tab: "properties" });
    requestAnimationFrame(() => {
      document
        .getElementById(PLUGIN_DIAGNOSTICS_PANEL_ID)
        ?.scrollIntoView({ block: "nearest" });
    });
  }, []);
  const { commandRegistry, runCommand } = useWriterCommands({
    profile: engine.profile,
    platform,
    acpSettings,
    activeEditorRef,
    sessionDocumentRef,
    sessionWorkspaceRef,
    setStatus,
    changeMetadata,
    importBlogDocuments,
    saveCurrentVersion,
    setAiOperationState,
    setAiReviewState,
    showAiReview,
    dispatchWorkbenchState,
    openDocumentSearch: () => setIsDocumentSearchOpen(true),
    openCommandPalette: () => setIsCommandPaletteOpen(true),
    openQuickOpen: () => setIsQuickOpenOpen(true),
    showWorkspaceDiagnostics,
    createNewDocument,
    openDocument: openFromDialog,
    revertDocument: revert,
    closeDocument: close,
  });
  const saveAcpSettings = useCallback(
    (nextSettings: AcpSettings) => {
      persistAcpSettings(nextSettings);
      setAcpSettings(nextSettings);
      setAcpCheckState({ status: "idle", message: "Saved" });
      closeSettings();
      setStatus("AI settings saved");
    },
    [closeSettings, setStatus],
  );
  const saveAssetSettings = useCallback(
    async (nextSettings: AssetUploadSettings) => {
      try {
        const saved = await platform.assetUpload.saveSettings(nextSettings);
        setAssetSettings(saved);
        setAssetCheckState({ status: "idle", message: "Saved" });
        closeSettings();
        setStatus("Asset settings saved");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setAssetCheckState({ status: "error", message });
        setStatus(message);
      }
    },
    [closeSettings, platform.assetUpload, setStatus],
  );
  const saveProfileSettings = useCallback(
    (profileId: string) => {
      engine.setProfileId(profileId);
      closeSettings();
      setStatus("Editor settings saved");
    },
    [closeSettings, engine, setStatus],
  );
  const checkAcpAgent = useCallback(
    async (config: AcpAgentRuntimeConfig) => {
      setAcpCheckState({ status: "checking", message: "Checking" });

      try {
        const result = await platform.ai.check(config);
        setAcpCheckState({
          status: result.ok ? "success" : "error",
          message: result.message,
        });
      } catch (error: unknown) {
        setAcpCheckState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [platform.ai],
  );
  const checkAssetSettings = useCallback(
    async (settings: AssetUploadSettings) => {
      setAssetCheckState({ status: "checking", message: "Checking" });

      try {
        const result = await platform.assetUpload.checkSettings(settings);
        setAssetCheckState({
          status: result.ok ? "success" : "error",
          message: result.message,
        });
      } catch (error: unknown) {
        setAssetCheckState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [platform.assetUpload],
  );
  const refreshWorkspacePlugins = useStableCallback(async () => {
    if (!platform.fileTreeStore.isAvailable) {
      setWorkspacePlugins([]);
      setWorkspacePluginCheckState({
        status: "idle",
        message: "Workspace plugins require the desktop app",
      });
      return;
    }

    const workspace = engine.workspace;
    if (!workspace) {
      setWorkspacePlugins([]);
      setWorkspacePluginCheckState({
        status: "idle",
        message: "Open a workspace file to inspect plugins",
      });
      return;
    }

    setWorkspacePluginCheckState({
      status: "checking",
      message: "Scanning workspace plugins",
    });

    try {
      const plugins = await platform.pluginResolver.resolveWorkspacePlugins(
        workspace.root,
      );
      setWorkspacePlugins(plugins);
      setWorkspacePluginCheckState({
        status: "success",
        message:
          plugins.length === 1
            ? "1 workspace plugin found"
            : `${plugins.length} workspace plugins found`,
      });
    } catch (error: unknown) {
      setWorkspacePluginCheckState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
  const setWorkspacePluginTrust = useStableCallback(
    async (plugin: ResolvedPlugin, trusted: boolean) => {
      setWorkspacePluginCheckState({
        status: "checking",
        message: trusted ? "Trusting plugin" : "Revoking plugin trust",
      });

      try {
        await platform.pluginResolver.setWorkspacePluginTrust({
          workspaceRoot: plugin.workspaceRoot,
          packageId: plugin.packageId,
          version: plugin.version,
          bundleHash: plugin.bundleHash,
          trusted,
        });

        const loadPath = sessionDocumentRef.current
          ? (activeDocumentFilePath ?? engine.workspace?.root ?? plugin.workspaceRoot)
          : (engine.workspace?.root ?? plugin.workspaceRoot);
        const loaded = await loadTrustedWorkspacePlugins(
          loadPath,
          platform.pluginResolver,
        );
        await engine.activateWorkspacePlugins(loaded.workspace, loaded.plugins);
        await refreshWorkspacePlugins();
        setStatus(trusted ? "Workspace plugin trusted" : "Workspace plugin trust revoked");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setWorkspacePluginCheckState({ status: "error", message });
        setStatus(message);
      }
    },
  );
  useEffect(() => {
    void refreshWorkspacePlugins();
  }, [engine.workspace?.root, refreshWorkspacePlugins]);
  const applyDocumentBodyReplacement = useCallback(
    (nextBody: string) => {
      // The MDXEditor is uncontrolled after mount, so push the rewritten body
      // through its imperative API *and* the session so both stay in sync.
      activeEditorRef.current?.setMarkdown?.(nextBody);
      changeDocumentBody(nextBody);
      clearDocumentSearchHighlight();
    },
    [changeDocumentBody],
  );
  const replaceCurrentMatch = useCallback(() => {
    if (!documentEditor || !documentSearchQuery || activeSearchIndex < 0) return;

    const nextBody = replaceNthInSource(
      documentEditor.body,
      documentSearchQuery,
      documentReplaceQuery,
      activeSearchIndex,
      { caseSensitive: isSearchCaseSensitive },
    );
    if (nextBody === documentEditor.body) return;

    applyDocumentBodyReplacement(nextBody);
    // Keep the cursor on the same ordinal so repeated replace walks forward;
    // clamp happens naturally on the next match recompute.
    setActiveSearchIndex((current) => Math.max(0, current));
  }, [
    activeSearchIndex,
    applyDocumentBodyReplacement,
    documentEditor,
    documentReplaceQuery,
    documentSearchQuery,
    isSearchCaseSensitive,
  ]);
  const replaceAllMatches = useCallback(() => {
    if (!documentEditor || !documentSearchQuery) return;

    const { source: nextBody, count } = replaceAllInSource(
      documentEditor.body,
      documentSearchQuery,
      documentReplaceQuery,
      { caseSensitive: isSearchCaseSensitive },
    );
    if (count === 0 || nextBody === documentEditor.body) return;

    applyDocumentBodyReplacement(nextBody);
    setActiveSearchIndex(-1);
  }, [
    applyDocumentBodyReplacement,
    documentEditor,
    documentReplaceQuery,
    documentSearchQuery,
    isSearchCaseSensitive,
  ]);
  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);
  const toggleFileTreeDirectory = useCallback((path: string) => {
    setExpandedFileTreePaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);
  const loadFileTree = useCallback(
    async (root?: string) => {
      const roots = root ? [root] : fileTreeRoots;
      if (!platform.fileTreeStore.isAvailable || roots.length === 0) {
        setFileTreeNodesByRoot({});
        setFileTreeStatusByRoot({});
        return;
      }

      for (const targetRoot of roots) {
        setFileTreeStatusByRoot((current) => ({
          ...current,
          [targetRoot]: "Loading",
        }));
        try {
          const nodes = await platform.fileTreeStore.listTree(targetRoot);
          setFileTreeNodesByRoot((current) => ({
            ...current,
            [targetRoot]: nodes,
          }));
          setFileTreeStatusByRoot((current) => ({
            ...current,
            [targetRoot]: nodes.length > 0 ? "Ready" : "No Markdown files",
          }));
        } catch (error: unknown) {
          setFileTreeNodesByRoot((current) => ({
            ...current,
            [targetRoot]: [],
          }));
          setFileTreeStatusByRoot((current) => ({
            ...current,
            [targetRoot]: String(error),
          }));
        }
      }
    },
    [fileTreeRoots, platform.fileTreeStore],
  );
  const openWorkspaceFolder = useCallback(async () => {
    const root = await platform.windowAdapter.openDirectory({
      title: "Open Folder",
    });
    if (!root) return;

    const nextRoots = addFileTreeRoot(fileTreeRoots, root);
    persistFileTreeRoots(nextRoots);
    setFileTreeRoots(nextRoots);
    setExpandedFileTreePaths((current) => new Set(current).add(root));
    await loadFileTree(root);
    requestAnimationFrame(() => {
      fileTreeRef.current?.open(root);
    });
  }, [fileTreeRoots, loadFileTree, platform.windowAdapter]);
  const refreshFileTree = useCallback(() => {
    void loadFileTree();
  }, [loadFileTree]);
  const openFileTreePath = useCallback(
    async (path: string) => {
      if (activeDocumentFilePath === path) return;
      if (session.isDirty) {
        await saveNow();
      }
      await openMarkdownPath(path);
    },
    [activeDocumentFilePath, openMarkdownPath, saveNow, session.isDirty],
  );
  const runQuickOpenItem = useCallback(
    async (item: QuickOpenItem) => {
      setIsQuickOpenOpen(false);
      setQuickOpenQuery("");

      try {
        if (item.kind === "document") {
          await openStoredDocument(item.documentId);
          return;
        }

        await openFileTreePath(item.path);
      } finally {
        restoreEditorFocus();
      }
    },
    [openFileTreePath, openStoredDocument, restoreEditorFocus],
  );
  const createInTree = useCallback(
    async (parentPath: string, kind: "file" | "directory") => {
      const root = findFileTreeRootForPath(fileTreeRoots, parentPath);
      if (!root) return;
      try {
        const created =
          kind === "file"
            ? await platform.fileTreeStore.createFile(parentPath, "Untitled.md")
            : await platform.fileTreeStore.createDirectory(
                parentPath,
                "New Folder",
              );
        setExpandedFileTreePaths((current) =>
          new Set(current).add(parentPath),
        );
        fileTreeRef.current?.open(parentPath);
        await loadFileTree(root);
        // Let react-arborist render the new node before entering rename mode.
        requestAnimationFrame(() => {
          void fileTreeRef.current?.edit(created.path);
        });
      } catch (error: unknown) {
        setStatus(String(error));
      }
    },
    [fileTreeRoots, loadFileTree, platform.fileTreeStore, setStatus],
  );
  const handleNewFile = useCallback(() => {
    if (activeFileTreeRoot) void createInTree(activeFileTreeRoot, "file");
  }, [activeFileTreeRoot, createInTree]);
  const handleNewFolder = useCallback(() => {
    if (activeFileTreeRoot) void createInTree(activeFileTreeRoot, "directory");
  }, [activeFileTreeRoot, createInTree]);
  const handleRename = useCallback(
    async (path: string, name: string) => {
      const root = findFileTreeRootForPath(fileTreeRoots, path);
      if (!root) return;
      try {
        if (activeDocumentFilePath === path && session.isDirty) {
          await saveNow();
        }
        const renamed = await platform.fileTreeStore.renamePath(path, name);
        await loadFileTree(root);
        if (activeDocumentFilePath === path && renamed.kind === "file") {
          await openMarkdownPath(renamed.path);
        }
      } catch (error: unknown) {
        setStatus(String(error));
      }
    },
    [
      fileTreeRoots,
      loadFileTree,
      openMarkdownPath,
      platform.fileTreeStore,
      saveNow,
      activeDocumentFilePath,
      session.isDirty,
      setStatus,
    ],
  );
  const runFileTreeAction = useCallback(
    async (action: FileTreeMenuAction, node: FileTreeNode) => {
      const root = findFileTreeRootForPath(fileTreeRoots, node.path);
      if (!root) return;

      try {
        if (action === "open" && node.kind === "file") {
          await openFileTreePath(node.path);
          return;
        }

        if (action === "toggle" && node.kind === "directory") {
          toggleFileTreeDirectory(node.path);
          return;
        }

        if (action === "set-publish-target" && node.kind === "directory") {
          persistPublishTarget(node.path);
          setPublishTargetPath(node.path);
          setStatus(`Publish target set to ${node.name}`);
          return;
        }

        if (action === "remove-root") {
          if (!node.isRoot) return;
          const nextRoots = removeFileTreeRoot(fileTreeRoots, root);
          persistFileTreeRoots(nextRoots);
          setFileTreeRoots(nextRoots);
          setFileTreeNodesByRoot((current) => omitRecordKey(current, root));
          setFileTreeStatusByRoot((current) => omitRecordKey(current, root));
          setExpandedFileTreePaths(
            (current) =>
              new Set(
                [...current].filter(
                  (path) =>
                    !isPathOnlyCoveredByFileTreeRoot(root, nextRoots, path),
                ),
              ),
          );
          if (
            publishTargetPath &&
            isPathOnlyCoveredByFileTreeRoot(root, nextRoots, publishTargetPath)
          ) {
            clearPublishTarget();
            setPublishTargetPath(null);
          }
          setStatus(`${node.name} removed from sidebar`);
          return;
        }

        if (action === "new-file" && node.kind === "directory") {
          await createInTree(node.path, "file");
          return;
        }

        if (action === "new-folder" && node.kind === "directory") {
          await createInTree(node.path, "directory");
          return;
        }

        if (action === "rename") {
          if (node.isRoot) return;
          void fileTreeRef.current?.edit(node.path);
          return;
        }

        if (action === "reveal-in-finder") {
          await platform.fileTreeStore.revealPath(node.path);
          return;
        }

        if (action === "copy-path") {
          await navigator.clipboard.writeText(node.path);
          setStatus("Path copied");
          return;
        }

        if (action === "copy-relative-path") {
          await navigator.clipboard.writeText(
            toRelativePath(root, node.path),
          );
          setStatus("Relative path copied");
          return;
        }

        if (action === "duplicate" && node.kind === "file") {
          const file = await platform.fileTreeStore.duplicateFile(node.path);
          await loadFileTree(root);
          await openFileTreePath(file.path);
          return;
        }

        if (action === "move-to-trash") {
          const shouldDelete = await platform.windowAdapter.confirm(
            `Move ${node.name} to the app trash?`,
            { title: "Move to Trash" },
          );
          if (!shouldDelete) return;
          if (activeDocumentFilePath === node.path && session.isDirty) {
            await saveNow();
          }
          await platform.fileTreeStore.moveToTrash(root, node.path);
          await loadFileTree(root);
          if (
            activeDocumentFilePath === node.path ||
            pathContains(node.path, activeDocumentFilePath)
          ) {
            await close();
          }
          setStatus("Moved to trash");
        }
      } catch (error: unknown) {
        setStatus(String(error));
      }
    },
    [
      close,
      createInTree,
      fileTreeRoots,
      loadFileTree,
      openFileTreePath,
      platform,
      publishTargetPath,
      saveNow,
      activeDocumentFilePath,
      session.isDirty,
      setStatus,
      toggleFileTreeDirectory,
    ],
  );
  const publishDraft = useCallback(
    async (draft: FileTreeDraftItem) => {
      try {
        const document =
          session.document?.id === draft.id && isActiveDraftDocument
            ? session.document
            : await platform.documentStore.get(draft.id);
        const targetPath = publishTarget
          ? buildPublishFilePath({
              targetPath: publishTarget.path,
              slug: document.slug,
            })
          : await platform.windowAdapter.saveMarkdownFile({
              title: "Publish Markdown file",
              defaultPath: `${document.slug || "untitled"}.md`,
            });

        if (!targetPath) return;

        const canOverwrite = await confirmPublishOverwrite({
          targetPath,
          fileStore: platform.fileStore,
          windowAdapter: platform.windowAdapter,
        });
        if (!canOverwrite) return;

        const published = await publishStoredDocument(draft.id, targetPath);
        if (!published) return;

        const root = findFileTreeRootForPath(fileTreeRoots, published.filePath);
        if (root) {
          const parentPath = getParentPath(published.filePath);
          if (parentPath) {
            setExpandedFileTreePaths((current) =>
              new Set(current).add(parentPath),
            );
          }
          await loadFileTree(root);
          if (parentPath) {
            requestAnimationFrame(() => {
              fileTreeRef.current?.open(parentPath);
            });
          }
        }
      } catch (error: unknown) {
        setStatus(String(error));
      }
    },
    [
      fileTreeRoots,
      loadFileTree,
      platform.documentStore,
      platform.fileStore,
      platform.windowAdapter,
      publishStoredDocument,
      publishTarget,
      session.document,
      isActiveDraftDocument,
      setStatus,
    ],
  );
  const runDraftAction = useCallback(
    async (action: FileTreeDraftAction, draft: FileTreeDraftItem) => {
      if (action === "open") {
        await openStoredDocument(draft.id);
        return;
      }

      if (action === "publish") {
        await publishDraft(draft);
        return;
      }

      if (action === "mark-wip") {
        await updateStoredDocumentStatus(draft.id, "WIP");
        return;
      }

      if (action === "archive") {
        await updateStoredDocumentStatus(draft.id, "archived");
        return;
      }

      const shouldDelete = await platform.windowAdapter.confirm(
        `Delete ${draft.title}?`,
        { title: "Delete draft" },
      );
      if (!shouldDelete) return;
      await deleteStoredDocument(draft.id);
    },
    [
      deleteStoredDocument,
      openStoredDocument,
      publishDraft,
      platform.windowAdapter,
      updateStoredDocumentStatus,
    ],
  );
  // Keep sidebar props stable when save status changes in the editor session.
  const handleFileTreeAction = useStableCallback(
    (action: FileTreeMenuAction, node: FileTreeNode) => {
      void runFileTreeAction(action, node);
    },
  );
  const handleDraftAction = useStableCallback(
    (action: FileTreeDraftAction, draft: FileTreeDraftItem) => {
      void runDraftAction(action, draft);
    },
  );
  const handleCreateNewDocument = useStableCallback(() => {
    void createNewDocument();
  });
  const handleOpenDraft = useStableCallback((id: string) => {
    void openStoredDocument(id);
  });
  const handleOpenFileTreePath = useStableCallback((path: string) => {
    void openFileTreePath(path);
  });
  const handleOpenWorkspaceFolder = useStableCallback(() => {
    void openWorkspaceFolder();
  });
  const handleRefreshFileTree = useStableCallback(() => {
    refreshFileTree();
  });
  const handleRenamePath = useStableCallback((path: string, name: string) => {
    void handleRename(path, name);
  });
  const openSettingsFromSidebar = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);
  const toggleThemeFromSidebar = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const restoreDocumentVersion = useCallback(
    (version: DocumentVersion) => {
      if (!session.document || !historyTargetId) return;

      historyStore.save(
        createDocumentVersion({
          targetId: historyTargetId,
          document: session.document,
          reason: "Before restore",
        }),
      );
      restoreDocument(documentFromVersion(session.document, version));
      setVersions(historyStore.list(historyTargetId));
    },
    [historyStore, historyTargetId, restoreDocument, session.document],
  );
  const jumpToOutlineItem = useCallback(
    (item: TocItem) => {
      const headings = Array.from(
        document.querySelectorAll<HTMLElement>(".live-mdx-content h1, .live-mdx-content h2, .live-mdx-content h3"),
      );
      const target =
        headings.find((heading) => heading.id === item.id) ??
        headings.find((heading) => heading.textContent?.trim() === item.text);

      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      activeEditorRef.current?.focus?.();
    },
    [],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(THEME_STORAGE_VERSION_KEY, THEME_STORAGE_VERSION);
  }, [theme]);

  useEffect(() => {
    persistWorkbenchState({ viewMode, inspectorTab }, window.localStorage);
  }, [viewMode, inspectorTab]);

  useEffect(() => {
    const previousViewMode = previousViewModeRef.current;
    previousViewModeRef.current = viewMode;

    if (!shouldRestoreEditorFocus(previousViewMode, viewMode)) return;

    restoreEditorFocus();
  }, [restoreEditorFocus, viewMode]);

  useEffect(() => {
    setVersions(historyTargetId ? historyStore.list(historyTargetId) : []);
  }, [historyStore, historyTargetId]);

  useEffect(() => {
    void loadFileTree();
  }, [loadFileTree]);

  useEffect(() => {
    if (!platform.fileTreeStore.isAvailable || fileTreeRoots.length === 0) return;

    const disposers: Array<() => void> = [];
    let active = true;

    for (const root of fileTreeRoots) {
      void platform.fileTreeStore
        .watchTree(root, (changedPath) => {
          // Don't yank the tree out from under an in-progress inline rename.
          if (fileTreeRef.current?.editingId) return;
          if (shouldSkipFileTreeRefresh(changedPath)) return;
          void loadFileTree(root);
        })
        .then((unwatch) => {
          if (active) {
            disposers.push(unwatch);
            return;
          }
          unwatch();
        })
        .catch(() => {});
    }

    return () => {
      active = false;
      for (const dispose of disposers) {
        dispose();
      }
    };
  }, [
    fileTreeRoots,
    loadFileTree,
    platform.fileTreeStore,
    shouldSkipFileTreeRefresh,
  ]);

  useEffect(() => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      for (const id of folderIds) {
        next.add(id);
      }
      return next;
    });
  }, [folderIds]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = getWriterKeyboardShortcutAction(event);
      if (action.kind === "none") return;

      event.preventDefault();
      if (action.kind === "command") {
        runCommand(action.commandId);
        return;
      }

      if (action.kind === "command-palette") {
        setIsCommandPaletteOpen(true);
        return;
      }

      if (action.kind === "quick-open") {
        setIsQuickOpenOpen(true);
        return;
      }

      if (action.kind === "save") {
        void saveNow();
        return;
      }

      if (action.kind === "document-replace") {
        setIsDocumentSearchOpen(true);
        setIsReplaceVisible(true);
        return;
      }

      setIsDocumentSearchOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runCommand, saveNow]);

  useEffect(() => {
    if (!isDocumentStartStateVisible) return;

    const handlePaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || isEditablePasteTarget(document.activeElement)) {
        return;
      }

      const markdown = getMarkdownTextFromClipboardData(event.clipboardData);
      if (!markdown) return;

      event.preventDefault();
      pasteMarkdownIntoEmptyDocument(markdown);
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isDocumentStartStateVisible, pasteMarkdownIntoEmptyDocument]);

  useEffect(() => {
    return window.madinahWriter?.onWriterCommand((payload) => {
      const commandId = getWriterCommandIdFromPayload(payload);
      if (commandId) {
        runCommand(commandId);
      }
    });
  }, [runCommand]);

  useEffect(() => {
    if (!window.madinahWriter) return undefined;

    const handleContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (!shouldOpenFallbackDevContextMenu(event.target)) return;

      event.preventDefault();
      void platform.windowAdapter.showContextMenu({
        groups: [],
        position: {
          x: event.clientX,
          y: event.clientY,
        },
      });
    };

    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, [platform.windowAdapter]);

  const sidebarTools = useMemo(
    () => (
      <WriterSidebarTools
        wordCount={formatWordCount(metrics.words)}
        theme={theme}
        onOpenSettings={openSettingsFromSidebar}
        onToggleTheme={toggleThemeFromSidebar}
      />
    ),
    [metrics.words, openSettingsFromSidebar, theme, toggleThemeFromSidebar],
  );

  return (
    <main className="writer-simple-app">
      <section
        className={[
          "writer-window",
          isSidebarVisible ? "" : "is-sidebar-hidden",
          isInspectorVisible ? "" : "is-inspector-hidden",
          isFocusMode ? "is-focus-mode" : "",
          isTypewriterMode ? "is-typewriter-mode" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={workbenchLayoutStyle}
        data-view-mode={viewMode}
        data-inspector-tab={inspectorTab}
        aria-label="Madinah Writer"
      >
        <header
          className="writer-titlebar"
          data-window-drag-region
        >
          <div className="writer-titlebar-leading">
            <button
              type="button"
              className={`writer-toolbar-button${isSidebarVisible ? " is-active" : ""}`}
              data-window-no-drag
              aria-label={isSidebarVisible ? "隐藏侧边栏" : "显示侧边栏"}
              title={isSidebarVisible ? "隐藏侧边栏" : "显示侧边栏"}
              onClick={() => dispatchWorkbenchState({ type: "toggleSidebar" })}
            >
              <PanelLeft size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="writer-titlebar-meta">
            <button
              type="button"
              className="writer-toolbar-button"
              data-window-no-drag
              aria-label="Quick open"
              title="Quick open"
              onClick={() => setIsQuickOpenOpen(true)}
            >
              <Search size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`writer-toolbar-button${isInspectorVisible ? " is-active" : ""}`}
              data-window-no-drag
              aria-label={isInspectorVisible ? "隐藏属性面板" : "显示属性面板"}
              title={isInspectorVisible ? "隐藏属性面板" : "显示属性面板"}
              onClick={() => dispatchWorkbenchState({ type: "toggleInspector" })}
            >
              <PanelRight size={16} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="writer-workbench">
          {isSidebarVisible ? (
            platform.fileTreeStore.isAvailable ? (
              <FileTreeSidebar
                activePath={activeDocumentFilePath}
                activeDocumentId={
                  activeDocumentFilePath ? null : session.document?.id ?? null
                }
                drafts={sidebarDrafts}
                expandedPaths={expandedFileTreePaths}
                isAvailable={platform.fileTreeStore.isAvailable}
                nodes={fileTreeNodes}
                publishTargetLabel={publishTarget?.label ?? null}
                roots={fileTreeRoots}
                status={fileTreeStatus}
                treeRef={fileTreeRef}
                onAction={handleFileTreeAction}
                onDraftAction={handleDraftAction}
                onNewDocument={handleCreateNewDocument}
                onNewFile={handleNewFile}
                onNewFolder={handleNewFolder}
                onOpenDraft={handleOpenDraft}
                onOpenFile={handleOpenFileTreePath}
                onOpenFolder={handleOpenWorkspaceFolder}
                onRefresh={handleRefreshFileTree}
                onRename={handleRenamePath}
                onToggleDirectory={toggleFileTreeDirectory}
                footer={sidebarTools}
              />
            ) : (
              <WriterSidebar
                tree={sidebarTree}
                activeDocumentId={session.document?.id ?? null}
                expandedFolders={expandedFolders}
                showsFileDetails={showsFileDetails}
                onToggleFolder={toggleFolder}
                onOpen={handleOpenDraft}
                footer={sidebarTools}
              />
            )
          ) : null}

          {isSidebarVisible && !isFocusMode ? (
            <WorkbenchResizeHandle
              pane="sidebar"
              width={paneWidths.sidebar}
              onPointerDown={beginPaneResize}
              onKeyDown={handlePaneResizeKeyDown}
            />
          ) : null}

          <section
            className="writer-simple-canvas"
            aria-label={viewMode === "preview" ? "Preview" : "Editor"}
          >
            <AiOperationBanner state={aiOperationState} />
            <div className="writer-canvas-actions">
              <ViewModeControl
                viewMode={viewMode}
                onViewModeChange={(nextViewMode) =>
                  dispatchWorkbenchState({
                    type: "setViewMode",
                    viewMode: nextViewMode,
                  })
                }
              />
              {session.document ? (
                <SaveStatusIndicator session={session} status={status} />
              ) : null}
            </div>
            {session.document ? (
              viewMode === "write" && isDocumentStartStateVisible ? (
                <DocumentStartState onStart={startEditingEmptyDocument} />
              ) : (
                <>
                  {viewMode === "write" && isDocumentSearchOpen ? (
                    <DocumentSearchBar
                      query={documentSearchQuery}
                      matches={documentSearchMatches}
                      activeIndex={activeSearchIndex}
                      replaceVisible={isReplaceVisible}
                      replaceQuery={documentReplaceQuery}
                      caseSensitive={isSearchCaseSensitive}
                      onQueryChange={(query) => {
                        setDocumentSearchQuery(query);
                        setActiveSearchIndex(query ? 0 : -1);
                        clearDocumentSearchHighlight();
                      }}
                      onReplaceQueryChange={setDocumentReplaceQuery}
                      onToggleReplace={() =>
                        setIsReplaceVisible((visible) => !visible)
                      }
                      onToggleCaseSensitive={() => {
                        setIsSearchCaseSensitive((value) => !value);
                        setActiveSearchIndex(documentSearchQuery ? 0 : -1);
                        clearDocumentSearchHighlight();
                      }}
                      onReplaceOne={replaceCurrentMatch}
                      onReplaceAll={replaceAllMatches}
                      onClose={() => {
                        closeDocumentSearch();
                      }}
                      onNavigate={(direction) => {
                        const nextIndex = getAdjacentMatchIndex(
                          activeSearchIndex,
                          documentSearchMatches.length,
                          direction,
                        );
                        setActiveSearchIndex(nextIndex);
                        scrollSearchMatchIntoView(documentSearchQuery, nextIndex);
                      }}
                    />
                  ) : null}
                  {viewMode === "preview" ? (
                    <Suspense fallback={null}>
                      <PreviewPane document={session.document} />
                    </Suspense>
                  ) : documentEditor ? (
                    <DocumentEditorShell
                      title={documentEditor.title}
                      onTitleChange={changeDocumentTitle}
                    >
                      <MarkdownEditor
                        key={`${session.document.id}:${editorMode}`}
                        value={documentEditor.body}
                        documentId={session.document.id}
                        documentRef={sessionDocumentRef}
                        workspaceRef={sessionWorkspaceRef}
                        valueEpoch={session.contentEpoch}
                        editorPlugins={
                          engine.profile.editorPlugins ?? EMPTY_EDITOR_PLUGINS
                        }
                        editorMode={editorMode}
                        commandRegistry={commandRegistry}
                        imageUploadHandler={imageUploadHandler}
                        autoFocus={
                          !shouldAutoFocusDocumentTitle(documentEditor.title)
                        }
                        contextMenuItems={EDITOR_CONTEXT_MENU_ITEMS}
                        isAiOperationRunning={
                          aiOperationState.status === "running"
                        }
                        activeAiCommandId={
                          aiOperationState.status === "running"
                            ? aiOperationState.commandId
                            : null
                        }
                        onEditorReady={handleEditorReady}
                        onChange={handleEditorBodyChange}
                        onError={handleEditorError}
                      />
                    </DocumentEditorShell>
                  ) : null}
                </>
              )
            ) : (
              <WriterEmptyState
                status={status}
                canOpenFolder={platform.fileTreeStore.isAvailable}
                onNewDocument={handleCreateNewDocument}
                onOpenFolder={handleOpenWorkspaceFolder}
              />
            )}
          </section>

          {isInspectorVisible && session.document ? (
            <DocumentInspector
              document={session.document}
              metrics={metrics}
              versions={versions}
              profileName={engine.profile.name}
              pluginDiagnostics={engine.diagnostics}
              aiReviewState={aiReviewState}
              workspace={engine.workspace}
              activeTab={inspectorTab}
              onTabChange={(tab) =>
                dispatchWorkbenchState({ type: "showInspectorTab", tab })
              }
              onMetadataChange={changeMetadata}
              onOutlineJump={jumpToOutlineItem}
              onRunAiReview={() => void runCommand(AI_REVIEW_DOCUMENT_COMMAND_ID)}
              onSaveVersion={() => saveCurrentVersion()}
              onRestoreVersion={restoreDocumentVersion}
            />
          ) : null}

          {isInspectorVisible && session.document && !isFocusMode ? (
            <WorkbenchResizeHandle
              pane="inspector"
              width={paneWidths.inspector}
              onPointerDown={beginPaneResize}
              onKeyDown={handlePaneResizeKeyDown}
            />
          ) : null}
        </div>
      </section>
      {isQuickOpenOpen ? (
        <QuickOpenDialog
          query={quickOpenQuery}
          results={quickOpenResults}
          onQueryChange={setQuickOpenQuery}
          onClose={closeQuickOpen}
          onRun={(item) => void runQuickOpenItem(item)}
        />
      ) : null}
      {isCommandPaletteOpen ? (
        <Suspense fallback={null}>
          <CommandPalette
            commands={commandRegistry.list("palette")}
            query={commandPaletteQuery}
            onQueryChange={setCommandPaletteQuery}
            onClose={closeCommandPalette}
            onRun={(command) => {
              setIsCommandPaletteOpen(false);
              setCommandPaletteQuery("");
              void runCommand(command.id).finally(() => {
                if (!COMMANDS_THAT_OPEN_OVERLAYS.has(command.id)) {
                  restoreEditorFocus();
                }
              });
            }}
          />
        </Suspense>
      ) : null}
      {isSettingsOpen ? (
        <Suspense fallback={null}>
          <WriterSettingsDialog
            isOpen={isSettingsOpen}
            aiAvailable={platform.ai.isAvailable}
            assetUploadAvailable={platform.assetUpload.isAvailable}
            workspacePluginsAvailable={platform.fileTreeStore.isAvailable}
            profiles={engine.profiles}
            profileId={engine.profile.id}
            workspace={engine.workspace}
            workspacePlugins={workspacePlugins}
            pluginDiagnostics={engine.diagnostics}
            acpSettings={acpSettings}
            assetSettings={assetSettings}
            acpCheckState={acpCheckState}
            assetCheckState={assetCheckState}
            workspacePluginCheckState={workspacePluginCheckState}
            onClose={closeSettings}
            onSaveProfile={saveProfileSettings}
            onSaveAcp={saveAcpSettings}
            onCheckAcp={(config) => void checkAcpAgent(config)}
            onSaveAssets={(settings) => void saveAssetSettings(settings)}
            onCheckAssets={(settings) => void checkAssetSettings(settings)}
            onRefreshWorkspacePlugins={() => void refreshWorkspacePlugins()}
            onSetWorkspacePluginTrust={(plugin, trusted) =>
              void setWorkspacePluginTrust(plugin, trusted)
            }
          />
        </Suspense>
      ) : null}
    </main>
  );
}

const WriterSidebar = memo(function WriterSidebar({
  tree,
  activeDocumentId,
  expandedFolders,
  showsFileDetails,
  footer,
  onToggleFolder,
  onOpen,
}: {
  tree: SidebarTreeNode[];
  activeDocumentId: string | null;
  expandedFolders: Set<string>;
  showsFileDetails: boolean;
  footer?: ReactNode;
  onToggleFolder: (folderId: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <aside className="writer-sidebar" aria-label="文稿列表">
      <div className="writer-sidebar-header" data-window-drag-region>
        <span>FILES</span>
      </div>

      <nav
        className={`file-tree${showsFileDetails ? "" : " is-compact"}`}
        aria-label="Files"
      >
        {tree.map((node) =>
          renderTreeNode({
            activeDocumentId,
            depth: 0,
            expandedFolders,
            node,
            onOpen,
            onToggleFolder,
            showsFileDetails,
          }),
        )}
      </nav>
      {footer}
    </aside>
  );
});

function QuickOpenDialog({
  query,
  results,
  onQueryChange,
  onClose,
  onRun,
}: {
  query: string;
  results: QuickOpenItem[];
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onRun: (item: QuickOpenItem) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex((current) =>
      results.length === 0 ? 0 : Math.min(current, results.length - 1),
    );
  }, [results.length]);
  const activeOptionId =
    results[selectedIndex] && getQuickOpenOptionId(results[selectedIndex].id);

  return (
    <div className="quick-open-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="quick-open-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Quick open"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="quick-open-input-row">
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
                if (item) onRun(item);
              }
            }}
            placeholder="Search notes and files"
            aria-label="Search notes and files"
          />
        </div>
        <div
          className="quick-open-results"
          role="listbox"
          aria-activedescendant={activeOptionId || undefined}
        >
          {results.length > 0 ? (
            results.map((item, index) => (
              <button
                key={item.id}
                type="button"
                id={getQuickOpenOptionId(item.id)}
                className={index === selectedIndex ? "is-selected" : undefined}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => onRun(item)}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <FileCode2 size={16} aria-hidden="true" />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.detail || item.kind}</small>
                </span>
              </button>
            ))
          ) : (
            <QuickOpenEmpty query={query} />
          )}
        </div>
      </div>
    </div>
  );
}

function getQuickOpenOptionId(id: string): string {
  return `quick-open-option-${id.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function QuickOpenEmpty({ query }: { query: string }) {
  const normalized = query.trim();

  if (!normalized) {
    return <div className="quick-open-empty">No results</div>;
  }

  return (
    <div className="quick-open-empty">
      No results for <strong>{normalized}</strong>
    </div>
  );
}

function WriterSidebarTools({
  wordCount,
  theme,
  onOpenSettings,
  onToggleTheme,
}: {
  wordCount: string;
  theme: WriterTheme;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
}) {
  const themeLabel = theme === "dark" ? "切换到浅色模式" : "切换到深色模式";

  return (
    <footer className="writer-sidebar-tools" data-window-no-drag>
      <div className="writer-sidebar-tools-header">
        <span className="writer-sidebar-word-count">{wordCount}</span>
        <div className="writer-sidebar-tool-actions">
          <button
            type="button"
            className="writer-sidebar-tool-button"
            aria-label="Settings"
            title="Settings"
            onClick={onOpenSettings}
          >
            <Settings size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="writer-sidebar-tool-button"
            aria-label={themeLabel}
            title={themeLabel}
            onClick={onToggleTheme}
          >
            {theme === "dark" ? (
              <Sun size={15} aria-hidden="true" />
            ) : (
              <Moon size={15} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </footer>
  );
}

function DocumentSearchBar({
  query,
  matches,
  activeIndex,
  replaceVisible,
  replaceQuery,
  caseSensitive,
  onQueryChange,
  onReplaceQueryChange,
  onToggleReplace,
  onToggleCaseSensitive,
  onReplaceOne,
  onReplaceAll,
  onClose,
  onNavigate,
}: {
  query: string;
  matches: DocumentSearchMatch[];
  activeIndex: number;
  replaceVisible: boolean;
  replaceQuery: string;
  caseSensitive: boolean;
  onQueryChange: (query: string) => void;
  onReplaceQueryChange: (query: string) => void;
  onToggleReplace: () => void;
  onToggleCaseSensitive: () => void;
  onReplaceOne: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
  onNavigate: (direction: "next" | "previous") => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasMatches = Boolean(query) && matches.length > 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="document-search-bar"
      role="search"
      data-replace={replaceVisible ? "true" : undefined}
    >
      <button
        type="button"
        className="document-search-toggle"
        aria-label={replaceVisible ? "Hide replace" : "Show replace"}
        aria-expanded={replaceVisible}
        title={replaceVisible ? "隐藏替换" : "显示替换"}
        onClick={onToggleReplace}
      >
        <ChevronRight
          size={14}
          aria-hidden="true"
          className="document-search-toggle-icon"
        />
      </button>
      <div className="document-search-fields">
        <div className="document-search-row">
          <Search size={14} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
              }

              if (event.key === "Enter") {
                event.preventDefault();
                onNavigate(event.shiftKey ? "previous" : "next");
              }
            }}
            placeholder="Find in document"
            aria-label="Find in document"
          />
          <button
            type="button"
            className="document-search-option"
            data-active={caseSensitive ? "true" : undefined}
            aria-label="Match case"
            aria-pressed={caseSensitive}
            title="区分大小写"
            onClick={onToggleCaseSensitive}
          >
            <CaseSensitive size={15} aria-hidden="true" />
          </button>
          <span className="document-search-count" aria-live="polite">
            {hasMatches ? `${activeIndex + 1}/${matches.length}` : "0/0"}
          </span>
          <button
            type="button"
            aria-label="Previous match"
            title="上一个匹配"
            onClick={() => onNavigate("previous")}
          >
            <ChevronUp size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next match"
            title="下一个匹配"
            onClick={() => onNavigate("next")}
          >
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Close search"
            title="关闭 (Esc)"
            onClick={onClose}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        {replaceVisible ? (
          <div className="document-search-row document-search-row-replace">
            <Replace size={14} aria-hidden="true" />
            <input
              value={replaceQuery}
              onChange={(event) =>
                onReplaceQueryChange(event.currentTarget.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onClose();
                  return;
                }

                if (event.key === "Enter") {
                  event.preventDefault();
                  if (event.shiftKey) {
                    onReplaceAll();
                  } else {
                    onReplaceOne();
                  }
                }
              }}
              placeholder="Replace with"
              aria-label="Replace with"
            />
            <button
              type="button"
              className="document-search-replace-action"
              onClick={onReplaceOne}
              disabled={!hasMatches}
              title="替换当前 (Enter)"
            >
              替换
            </button>
            <button
              type="button"
              className="document-search-replace-action"
              onClick={onReplaceAll}
              disabled={!hasMatches}
              title="全部替换 (Shift+Enter)"
            >
              全部
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getInitialTheme(): WriterTheme {
  const version = window.localStorage.getItem(THEME_STORAGE_VERSION_KEY);
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (version === THEME_STORAGE_VERSION && (saved === "dark" || saved === "light")) {
    return saved;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function DocumentStartState({ onStart }: { onStart: () => void }) {
  return (
    <div className="document-start-state">
      <div className="document-start-copy">
        <p>纸页已铺开，第一行正等风来。</p>
        <span>把今天没说完的念头，交给这一页。</span>
      </div>
      <button
        type="button"
        className="document-start-button"
        onClick={onStart}
      >
        <PencilLine size={15} aria-hidden="true" />
        开始书写
      </button>
    </div>
  );
}

function isEditablePasteTarget(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;

  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element.closest('[contenteditable="true"]') !== null
  );
}

function WriterEmptyState({
  canOpenFolder,
  status,
  onNewDocument,
  onOpenFolder,
}: {
  canOpenFolder: boolean;
  status: string;
  onNewDocument: () => void;
  onOpenFolder: () => void;
}) {
  return (
    <div className="writer-empty-state">
      <div className="writer-empty-panel">
        <p>{status || "No document open"}</p>
        <div className="writer-empty-actions">
          {canOpenFolder ? (
            <button type="button" onClick={onOpenFolder}>
              <FolderOpen size={15} aria-hidden="true" />
              Open Folder
            </button>
          ) : null}
          <button type="button" onClick={onNewDocument}>
            <PencilLine size={15} aria-hidden="true" />
            New Document
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentEditorShell({
  children,
  title,
  onTitleChange,
}: {
  children: ReactNode;
  title: string;
  onTitleChange: (title: string) => void;
}) {
  return (
    <div className="document-editor-shell">
      <input
        aria-label="标题"
        autoFocus={shouldAutoFocusDocumentTitle(title)}
        className="document-title-input"
        placeholder={DOCUMENT_TITLE_PLACEHOLDER}
        value={title}
        onChange={(event) => onTitleChange(event.currentTarget.value)}
      />
      {children}
    </div>
  );
}

function WorkbenchResizeHandle({
  pane,
  width,
  onPointerDown,
  onKeyDown,
}: {
  pane: WorkbenchPane;
  width: number;
  onPointerDown: (
    pane: WorkbenchPane,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onKeyDown: (
    pane: WorkbenchPane,
    event: ReactKeyboardEvent<HTMLElement>,
  ) => void;
}) {
  const label = pane === "sidebar" ? "调整侧边栏宽度" : "调整属性面板宽度";
  const bounds = WORKBENCH_PANE_WIDTH_BOUNDS[pane];

  return (
    <div
      role="separator"
      tabIndex={0}
      className={`writer-pane-resize-handle is-${pane}`}
      data-window-no-drag
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuenow={width}
      aria-valuetext={`${width}px`}
      title={label}
      onPointerDown={(event) => onPointerDown(pane, event)}
      onKeyDown={(event) => onKeyDown(pane, event)}
    />
  );
}

function persistFileTreeRoots(roots: string[]) {
  window.localStorage.setItem(
    FILE_TREE_ROOTS_STORAGE_KEY,
    serializeFileTreeRoots(roots),
  );
  window.localStorage.removeItem(LEGACY_FILE_TREE_ROOT_STORAGE_KEY);
}

function persistPublishTarget(path: string) {
  window.localStorage.setItem(PUBLISH_TARGET_STORAGE_KEY, path);
}

function clearPublishTarget() {
  window.localStorage.removeItem(PUBLISH_TARGET_STORAGE_KEY);
}

function omitRecordKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function getParentPath(path: string): string | null {
  const index = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (index <= 0) return null;
  return path.slice(0, index);
}

function scrollSearchMatchIntoView(query: string, occurrenceIndex: number) {
  scrollActiveDocumentSearchMatchIntoView({
    root: document.querySelector<HTMLElement>(".live-mdx-content, .cm-content"),
    query,
    occurrenceIndex,
  });
}

function clearDocumentSearchHighlight() {
  clearActiveDocumentSearchMatch(document);
}

function shouldOpenFallbackDevContextMenu(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;

  return (
    target.closest(
      [
        "input",
        "textarea",
        "select",
        "a",
        '[contenteditable="true"]',
        ".live-mdx-shell",
        ".writer-sidebar",
        ".writer-inspector",
        ".document-search-bar",
        ".quick-open-dialog",
        ".writer-settings-dialog",
        ".editor-context-menu",
        ".file-tree-context-menu",
        ".slash-command-menu",
      ].join(","),
    ) === null
  );
}

function renderTreeNode({
  activeDocumentId,
  depth,
  expandedFolders,
  node,
  onOpen,
  onToggleFolder,
  showsFileDetails,
}: {
  activeDocumentId: string | null;
  depth: number;
  expandedFolders: Set<string>;
  node: SidebarTreeNode;
  onOpen: (id: string) => void;
  onToggleFolder: (folderId: string) => void;
  showsFileDetails: boolean;
}): ReactNode {
  const depthStyle = { "--tree-depth": depth } as CSSProperties;

  if (node.kind === "document") {
    const isActive = node.document.id === activeDocumentId;
    return (
      <button
        type="button"
        key={node.id}
        className={`tree-row is-file${isActive ? " is-active" : ""}`}
        style={depthStyle}
        aria-current={isActive ? "page" : undefined}
        onClick={() => onOpen(node.document.id)}
      >
        <FileCode2 className="tree-icon" size={18} aria-hidden="true" />
        <span className="tree-copy">
          <span className="tree-label">{node.label}</span>
          {showsFileDetails ? <small>{node.detail}</small> : null}
        </span>
      </button>
    );
  }

  const isExpanded = expandedFolders.has(node.id);

  return (
    <div className="tree-group" key={node.id}>
      <button
        type="button"
        className="tree-row is-folder"
        style={depthStyle}
        aria-expanded={isExpanded}
        onClick={() => onToggleFolder(node.id)}
      >
        {isExpanded ? (
          <ChevronDown className="tree-chevron" size={16} aria-hidden="true" />
        ) : (
          <ChevronRight className="tree-chevron" size={16} aria-hidden="true" />
        )}
        <Folder className="tree-icon" size={19} aria-hidden="true" />
        <span className="tree-label">{node.label}</span>
      </button>
      {isExpanded ? (
        <div className="tree-children">
          {node.children.map((child) =>
            renderTreeNode({
              activeDocumentId,
              depth: depth + 1,
              expandedFolders,
              node: child,
              onOpen,
              onToggleFolder,
              showsFileDetails,
            }),
          )}
        </div>
      ) : null}
    </div>
  );
}

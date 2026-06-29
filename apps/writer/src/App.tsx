import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  FileCheck2,
  FileClock,
  FileCode2,
  Folder,
  LoaderCircle,
  Moon,
  PanelLeft,
  PanelRight,
  PencilLine,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import type { TreeApi } from "react-arborist";
import type { AcpAgentRuntimeConfig } from "./domain/ai-polish";
import type { WriterEditor } from "./domain/engine";
import {
  type MarkdownDocument,
} from "./domain/document";
import { getWriterKeyboardShortcutAction } from "./features/commands/keyboard-shortcuts";
import {
  WRITER_COMMAND_EVENT,
  getWriterCommandIdFromPayload,
} from "./features/commands/native-menu";
import { CommandPalette } from "./features/commands/command-palette";
import {
  AcpSettingsDialog,
  type AcpCheckState,
} from "./features/ai-polish/AcpSettingsDialog";
import {
  AI_POLISH_COMMAND_ID,
  createAiPolishCommand,
} from "./features/ai-polish/command";
import {
  loadAcpSettings,
  saveAcpSettings as persistAcpSettings,
  type AcpSettings,
} from "./features/ai-polish/settings";
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
import { createFormattingCommands } from "./features/editor/formatting-commands";
import { CommandRegistry } from "./features/engine/CommandRegistry";
import { EngineProvider, useEngine } from "./features/engine/EngineProvider";
import { FileTreeSidebar } from "./features/file-tree/FileTreeSidebar";
import {
  addFileTreeRoot,
  buildFileTreeRootNodes,
  findFileTreeRootForPath,
  type FileTreeDraftAction,
  type FileTreeDraftItem,
  type FileTreeMenuAction,
  type FileTreeNode,
  getActiveFileTreeRoot,
  getFileTreeStatus,
  pathContains,
  parseFileTreeRoots,
  serializeFileTreeRoots,
  toRelativePath,
} from "./features/file-tree/file-tree";
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
  scrollActiveDocumentSearchMatchIntoView,
  type DocumentSearchMatch,
} from "./features/search/in-document-search";
import { DocumentInspector } from "./features/inspector/DocumentInspector";
import { PreviewPane } from "./features/preview/PreviewPane";
import { createDocumentCommands } from "./features/session/document-commands";
import { useDocumentSession } from "./features/session/useDocumentSession";
import { ViewModeControl } from "./features/workbench/ViewModeControl";
import { createWorkbenchCommands } from "./features/workbench/workbench-commands";
import {
  getInitialWorkbenchState,
  getSavePresentation,
  persistWorkbenchState,
  shouldRestoreEditorFocus,
  type SavePresentation,
  type SavePresentationIcon,
  workbenchStateReducer,
} from "./features/workbench/workbench-state";
import {
  buildFileTreeDraftItems,
  buildSidebarTree,
  collectFolderIds,
  formatWordCount,
  getDocumentDisplayTitle,
  getDocumentMetrics,
  mergeActiveDocument,
  type SidebarTreeNode,
} from "./features/workbench/document-summary";
import type { TocItem } from "./lib/toc";
import {
  createPlatformAdapters,
  type PlatformAdapters,
} from "./platform";

const THEME_STORAGE_KEY = "madinah-writer-theme";
const THEME_STORAGE_VERSION_KEY = "madinah-writer-theme-version";
const THEME_STORAGE_VERSION = "2";
const FILE_TREE_ROOTS_STORAGE_KEY = "madinah-writer-file-tree-roots";
const LEGACY_FILE_TREE_ROOT_STORAGE_KEY = "madinah-writer-file-tree-root";
const WINDOW_DRAG_IGNORE_SELECTOR =
  "button, a, input, textarea, select, [role='button'], [data-tauri-no-drag]";

type WriterTheme = "dark" | "light";

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
    updateStoredDocumentStatus,
    deleteStoredDocument,
    saveNow,
    saveAs,
    revert,
    close,
    setStatus,
  } = useDocumentSession(platform, engine.activateWorkspacePlugins);
  const visibleDocuments = useMemo(
    () => mergeActiveDocument(documents, session.document),
    [documents, session.document],
  );
  const draftDocuments = useMemo(
    () => mergeActiveDocument(documents, session.filePath ? null : session.document),
    [documents, session.document, session.filePath],
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
    () => getActiveFileTreeRoot(fileTreeRoots, session.filePath),
    [fileTreeRoots, session.filePath],
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
  const previousViewModeRef = useRef(viewMode);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [isDocumentSearchOpen, setIsDocumentSearchOpen] = useState(false);
  const [documentSearchQuery, setDocumentSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [startedEmptyDocumentId, setStartedEmptyDocumentId] = useState<
    string | null
  >(null);
  const [theme, setTheme] = useState<WriterTheme>(getInitialTheme);
  const [acpSettings, setAcpSettings] = useState<AcpSettings>(loadAcpSettings);
  const [isAcpSettingsOpen, setIsAcpSettingsOpen] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const historyStore = useMemo(() => createLocalDocumentHistoryStore(), []);
  const [acpCheckState, setAcpCheckState] = useState<AcpCheckState>({
    status: "idle",
    message: "Ready",
  });
  const documentTitle = session.document
    ? getDocumentDisplayTitle(session.document)
    : "Madinah Writer";
  const metrics = useMemo(
    () => getDocumentMetrics(session.document?.body ?? ""),
    [session.document?.body],
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
  const quickOpenItems = useMemo(
    () =>
      buildQuickOpenItems({
        documents: visibleDocuments,
        fileTreeNodes,
      }),
    [fileTreeNodes, visibleDocuments],
  );
  const quickOpenResults = useMemo(
    () => searchQuickOpenItems(quickOpenItems, quickOpenQuery).slice(0, 12),
    [quickOpenItems, quickOpenQuery],
  );
  const documentSearchMatches = useMemo(
    () =>
      findDocumentMatches(documentEditor?.body ?? "", documentSearchQuery).slice(0, 500),
    [documentEditor?.body, documentSearchQuery],
  );
  const historyTargetId = session.document
    ? getVersionTargetId(session.document, session.filePath)
    : null;
  const savePresentation = useMemo(
    () => getSavePresentation(session, status),
    [session, status],
  );
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

      changeSource(composeDocumentEditorMarkdown(documentEditor.title, body));
    },
    [changeSource, documentEditor, session.document],
  );
  const aiPolishCommand = useMemo(
    () =>
      createAiPolishCommand({
        aiPolish: platform.aiPolish,
        settings: acpSettings,
        setStatus,
      }),
    [acpSettings, platform.aiPolish, setStatus],
  );
  const formattingCommands = useMemo(() => createFormattingCommands(), []);
  const workbenchCommands = useMemo(
    () =>
      createWorkbenchCommands({
        dispatch: dispatchWorkbenchState,
        openDocumentSearch: () => setIsDocumentSearchOpen(true),
        openCommandPalette: () => setIsCommandPaletteOpen(true),
        openQuickOpen: () => setIsQuickOpenOpen(true),
      }),
    [],
  );
  const commandRegistry = useMemo(
    () =>
      new CommandRegistry(
        [
          ...(engine.profile.commands ?? []),
          ...formattingCommands,
          aiPolishCommand,
          ...workbenchCommands,
          ...createDocumentCommands({
            newDocument: createNewDocument,
            open: openFromDialog,
            save: saveNow,
            saveAs,
            revert,
            close,
          }),
        ],
      ),
    [
      aiPolishCommand,
      close,
      createNewDocument,
      engine.profile.commands,
      formattingCommands,
      openFromDialog,
      revert,
      saveAs,
      saveNow,
      workbenchCommands,
    ],
  );
  const saveAcpSettings = useCallback(
    (nextSettings: AcpSettings) => {
      persistAcpSettings(nextSettings);
      setAcpSettings(nextSettings);
      setAcpCheckState({ status: "idle", message: "Saved" });
      setIsAcpSettingsOpen(false);
      setStatus("AI settings saved");
    },
    [setStatus],
  );
  const checkAcpAgent = useCallback(
    async (config: AcpAgentRuntimeConfig) => {
      setAcpCheckState({ status: "checking", message: "Checking" });

      try {
        const result = await platform.aiPolish.check(config);
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
    [platform.aiPolish],
  );
  const runCommand = useCallback(
    (commandId: string) => {
      void commandRegistry
        .execute(commandId, {
          document: session.document,
          editor: activeEditorRef.current,
          workspace: session.workspace,
        })
        .catch((error: unknown) => setStatus(String(error)));
    },
    [commandRegistry, session.document, session.workspace, setStatus],
  );
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
      if (session.filePath === path) return;
      if (session.isDirty) {
        await saveNow();
      }
      await openMarkdownPath(path);
    },
    [openMarkdownPath, saveNow, session.filePath, session.isDirty],
  );
  const runQuickOpenItem = useCallback(
    async (item: QuickOpenItem) => {
      setIsQuickOpenOpen(false);
      setQuickOpenQuery("");

      if (item.kind === "document") {
        await openStoredDocument(item.documentId);
        return;
      }

      await openFileTreePath(item.path);
    },
    [openFileTreePath, openStoredDocument],
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
        if (session.filePath === path && session.isDirty) {
          await saveNow();
        }
        const renamed = await platform.fileTreeStore.renamePath(path, name);
        await loadFileTree(root);
        if (session.filePath === path && renamed.kind === "file") {
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
      session.filePath,
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

        if (action === "save-as" && node.kind === "file") {
          if (session.filePath === node.path) {
            await saveAs();
            return;
          }

          const target = await platform.windowAdapter.saveMarkdownFile({
            title: "Save Markdown file",
            defaultPath: node.name,
          });
          if (!target) return;
          const file = await platform.fileTreeStore.readFile(node.path);
          await platform.fileTreeStore.writeFile(target, file.source);
          await platform.recentStore.add(target);
          setStatus("Saved");
          return;
        }

        if (action === "move-to-trash") {
          const shouldDelete = await platform.windowAdapter.confirm(
            `Move ${node.name} to the app trash?`,
            { title: "Move to Trash" },
          );
          if (!shouldDelete) return;
          if (session.filePath === node.path && session.isDirty) {
            await saveNow();
          }
          await platform.fileTreeStore.moveToTrash(root, node.path);
          await loadFileTree(root);
          if (session.filePath === node.path || pathContains(node.path, session.filePath)) {
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
      saveAs,
      saveNow,
      session.filePath,
      session.isDirty,
      setStatus,
      toggleFileTreeDirectory,
    ],
  );
  const runDraftAction = useCallback(
    async (action: FileTreeDraftAction, draft: FileTreeDraftItem) => {
      if (action === "open") {
        await openStoredDocument(draft.id);
        return;
      }

      if (action === "publish") {
        await updateStoredDocumentStatus(draft.id, "published");
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
      platform.windowAdapter,
      updateStoredDocumentStatus,
    ],
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

    window.requestAnimationFrame(() => {
      activeEditorRef.current?.focus?.();
    });
  }, [viewMode]);

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
        .watchTree(root, () => {
          // Don't yank the tree out from under an in-progress inline rename.
          if (fileTreeRef.current?.editingId) return;
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
  }, [fileTreeRoots, loadFileTree, platform.fileTreeStore]);

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

      setIsDocumentSearchOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runCommand]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | null = null;

    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<unknown>(WRITER_COMMAND_EVENT, (event) => {
          const commandId = getWriterCommandIdFromPayload(event.payload);
          if (commandId) {
            runCommand(commandId);
          }
        }),
      )
      .then((nextUnlisten) => {
        if (active) {
          unlisten = nextUnlisten;
          return;
        }

        nextUnlisten();
      })
      .catch(() => {});

    return () => {
      active = false;
      unlisten?.();
    };
  }, [runCommand]);

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
        data-view-mode={viewMode}
        data-inspector-tab={inspectorTab}
        aria-label="Madinah Writer"
      >
        <header
          className="writer-titlebar"
          data-tauri-drag-region
          onPointerDown={startWindowDrag}
        >
          <div className="writer-titlebar-leading">
            <button
              type="button"
              className={`writer-toolbar-button${isSidebarVisible ? " is-active" : ""}`}
              data-tauri-no-drag
              aria-label={isSidebarVisible ? "隐藏侧边栏" : "显示侧边栏"}
              title={isSidebarVisible ? "隐藏侧边栏" : "显示侧边栏"}
              onClick={() => dispatchWorkbenchState({ type: "toggleSidebar" })}
            >
              <PanelLeft size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="writer-titlebar-title" data-tauri-drag-region>
            <strong data-tauri-drag-region>{documentTitle}</strong>
            <SaveStatusIndicator presentation={savePresentation} />
            <ViewModeControl
              viewMode={viewMode}
              onViewModeChange={(nextViewMode) =>
                dispatchWorkbenchState({
                  type: "setViewMode",
                  viewMode: nextViewMode,
                })
              }
            />
          </div>

          <div className="writer-titlebar-meta">
            <span className="writer-word-count" data-tauri-drag-region>
              {formatWordCount(metrics.words)}
            </span>
            <ProfilePicker
              profiles={engine.profiles}
              value={engine.profile.id}
              onChange={engine.setProfileId}
            />
            <button
              type="button"
              className="writer-toolbar-button"
              data-tauri-no-drag
              aria-label="Quick open"
              title="Quick open"
              onClick={() => setIsQuickOpenOpen(true)}
            >
              <Search size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="writer-toolbar-button"
              data-tauri-no-drag
              aria-label="AI settings"
              title="AI settings"
              onClick={() => setIsAcpSettingsOpen(true)}
            >
              <Settings size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="writer-toolbar-button"
              data-tauri-no-drag
              aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
              title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              {theme === "dark" ? (
                <Sun size={15} aria-hidden="true" />
              ) : (
                <Moon size={15} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className={`writer-toolbar-button${isInspectorVisible ? " is-active" : ""}`}
              data-tauri-no-drag
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
                activePath={session.filePath}
                activeDocumentId={session.filePath ? null : session.document?.id ?? null}
                drafts={sidebarDrafts}
                expandedPaths={expandedFileTreePaths}
                isAvailable={platform.fileTreeStore.isAvailable}
                nodes={fileTreeNodes}
                roots={fileTreeRoots}
                status={fileTreeStatus}
                treeRef={fileTreeRef}
                onAction={(action, node) => void runFileTreeAction(action, node)}
                onDraftAction={(action, draft) => void runDraftAction(action, draft)}
                onNewFile={handleNewFile}
                onNewFolder={handleNewFolder}
                onOpenDraft={(id) => void openStoredDocument(id)}
                onOpenFile={(path) => void openFileTreePath(path)}
                onOpenFolder={() => void openWorkspaceFolder()}
                onRefresh={refreshFileTree}
                onRename={(path, name) => void handleRename(path, name)}
                onToggleDirectory={toggleFileTreeDirectory}
              />
            ) : (
              <WriterSidebar
                tree={sidebarTree}
                activeDocumentId={session.document?.id ?? null}
                expandedFolders={expandedFolders}
                showsFileDetails={showsFileDetails}
                onToggleFolder={toggleFolder}
                onOpen={(id) => void openStoredDocument(id)}
              />
            )
          ) : null}

          <section
            className="writer-simple-canvas"
            aria-label={viewMode === "preview" ? "Preview" : "Editor"}
          >
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
                      onQueryChange={(query) => {
                        setDocumentSearchQuery(query);
                        setActiveSearchIndex(query ? 0 : -1);
                        clearDocumentSearchHighlight();
                      }}
                      onClose={() => {
                        setIsDocumentSearchOpen(false);
                        setDocumentSearchQuery("");
                        setActiveSearchIndex(-1);
                        clearDocumentSearchHighlight();
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
                    <PreviewPane document={session.document} />
                  ) : documentEditor ? (
                    <DocumentEditorShell
                      title={documentEditor.title}
                      onTitleChange={changeDocumentTitle}
                    >
                      <MarkdownEditor
                        key={`${session.document.id}:${editorMode}`}
                        value={documentEditor.body}
                        document={session.document}
                        workspace={session.workspace}
                        editorPlugins={engine.profile.editorPlugins ?? []}
                        editorMode={editorMode}
                        commandRegistry={commandRegistry}
                        autoFocus={
                          !shouldAutoFocusDocumentTitle(documentEditor.title)
                        }
                        contextMenuItems={[
                          {
                            id: "ai-polish",
                            label: "AI Polish",
                            commandId: AI_POLISH_COMMAND_ID,
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
                        ]}
                        onEditorReady={(editor) => {
                          activeEditorRef.current = editor;
                        }}
                        onChange={changeDocumentBody}
                        onError={(error) => setStatus(error)}
                      />
                    </DocumentEditorShell>
                  ) : null}
                </>
              )
            ) : (
              <div className="writer-empty-state">{status}</div>
            )}
          </section>

          {isInspectorVisible && session.document ? (
            <DocumentInspector
              document={session.document}
              versions={versions}
              profileName={engine.profile.name}
              activeTab={inspectorTab}
              onTabChange={(tab) =>
                dispatchWorkbenchState({ type: "showInspectorTab", tab })
              }
              onMetadataChange={changeMetadata}
              onOutlineJump={jumpToOutlineItem}
              onSaveVersion={() => saveCurrentVersion()}
              onRestoreVersion={restoreDocumentVersion}
            />
          ) : null}
        </div>
      </section>
      {isQuickOpenOpen ? (
        <QuickOpenDialog
          query={quickOpenQuery}
          results={quickOpenResults}
          onQueryChange={setQuickOpenQuery}
          onClose={() => {
            setIsQuickOpenOpen(false);
            setQuickOpenQuery("");
          }}
          onRun={(item) => void runQuickOpenItem(item)}
        />
      ) : null}
      {isCommandPaletteOpen ? (
        <CommandPalette
          commands={commandRegistry.list()}
          query={commandPaletteQuery}
          onQueryChange={setCommandPaletteQuery}
          onClose={() => {
            setIsCommandPaletteOpen(false);
            setCommandPaletteQuery("");
          }}
          onRun={(command) => {
            setIsCommandPaletteOpen(false);
            setCommandPaletteQuery("");
            runCommand(command.id);
          }}
        />
      ) : null}
      <AcpSettingsDialog
        isOpen={isAcpSettingsOpen}
        isAvailable={platform.aiPolish.isAvailable}
        settings={acpSettings}
        checkState={acpCheckState}
        onClose={() => setIsAcpSettingsOpen(false)}
        onSave={saveAcpSettings}
        onCheck={(config) => void checkAcpAgent(config)}
      />
    </main>
  );
}

function WriterSidebar({
  tree,
  activeDocumentId,
  expandedFolders,
  showsFileDetails,
  onToggleFolder,
  onOpen,
}: {
  tree: SidebarTreeNode[];
  activeDocumentId: string | null;
  expandedFolders: Set<string>;
  showsFileDetails: boolean;
  onToggleFolder: (folderId: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <aside className="writer-sidebar" aria-label="文稿列表">
      <div className="writer-sidebar-header" data-tauri-drag-region>
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
    </aside>
  );
}

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
        <div className="quick-open-results" role="listbox">
          {results.length > 0 ? (
            results.map((item, index) => (
              <button
                key={item.id}
                type="button"
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
            <div className="quick-open-empty">No results</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfilePicker({
  profiles,
  value,
  onChange,
}: {
  profiles: Array<{ id: string; name: string }>;
  value: string;
  onChange: (profileId: string) => void;
}) {
  return (
    <select
      className="writer-profile-picker"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      data-tauri-no-drag
      aria-label="Markdown profile"
      title="Markdown profile"
    >
      {profiles.map((profile) => (
        <option key={profile.id} value={profile.id}>
          {profile.name}
        </option>
      ))}
    </select>
  );
}

function DocumentSearchBar({
  query,
  matches,
  activeIndex,
  onQueryChange,
  onClose,
  onNavigate,
}: {
  query: string;
  matches: DocumentSearchMatch[];
  activeIndex: number;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onNavigate: (direction: "next" | "previous") => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="document-search-bar" role="search">
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
      <span className="document-search-count">
        {query && matches.length > 0 ? `${activeIndex + 1}/${matches.length}` : "0/0"}
      </span>
      <button
        type="button"
        aria-label="Previous match"
        title="Previous match"
        onClick={() => onNavigate("previous")}
      >
        <ChevronUp size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Next match"
        title="Next match"
        onClick={() => onNavigate("next")}
      >
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Close search"
        title="Close search"
        onClick={onClose}
      >
        <X size={14} aria-hidden="true" />
      </button>
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

function SaveStatusIndicator({
  presentation,
}: {
  presentation: SavePresentation;
}) {
  const Icon = getSaveStatusIcon(presentation.icon);

  return (
    <span
      className={[
        "writer-save-indicator",
        `is-${presentation.tone}`,
        presentation.isBusy ? "is-busy" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-save-state={presentation.state}
      data-tauri-drag-region
      role="img"
      aria-label={presentation.label}
      title={presentation.tooltip}
    >
      <Icon size={15} aria-hidden="true" />
    </span>
  );
}

function getSaveStatusIcon(icon: SavePresentationIcon) {
  switch (icon) {
    case "pencil":
      return PencilLine;
    case "file-clock":
      return FileClock;
    case "file-check":
      return FileCheck2;
    case "loader":
      return LoaderCircle;
    case "alert":
      return CircleAlert;
    case "check":
      return CheckCircle2;
  }
}

function persistFileTreeRoots(roots: string[]) {
  window.localStorage.setItem(
    FILE_TREE_ROOTS_STORAGE_KEY,
    serializeFileTreeRoots(roots),
  );
  window.localStorage.removeItem(LEGACY_FILE_TREE_ROOT_STORAGE_KEY);
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

function startWindowDrag(event: ReactPointerEvent<HTMLElement>) {
  if (event.button !== 0) return;

  const target = event.target;
  if (
    target instanceof HTMLElement &&
    target.closest(WINDOW_DRAG_IGNORE_SELECTOR)
  ) {
    return;
  }

  void getCurrentWindow().startDragging().catch(() => {});
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

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  FileCode2,
  Folder,
  PanelRight,
  Search,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import type { TreeApi } from "react-arborist";
import type { AcpAgentRuntimeConfig } from "./domain/ai-polish";
import { AnimatedList } from "./components/magicui/animated-list";
import {
  MagicButton,
  MagicInput,
  MagicSelect,
  MagicTextarea,
} from "./components/magicui/form-controls";
import { NumberTicker } from "./components/magicui/number-ticker";
import {
  type DocumentMetadataPatch,
  type DocumentStatus,
  extractDocumentTitle,
  type MarkdownDocument,
} from "./domain/document";
import {
  WRITER_COMMAND_EVENT,
  getWriterCommandIdFromPayload,
} from "./features/commands/native-menu";
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
import { MarkdownEditor } from "./features/editor/MarkdownEditor";
import { CommandRegistry } from "./features/engine/CommandRegistry";
import { EngineProvider, useEngine } from "./features/engine/EngineProvider";
import { FileTreeSidebar } from "./features/file-tree/FileTreeSidebar";
import {
  type FileTreeMenuAction,
  type FileTreeNode,
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
import { createDocumentCommands } from "./features/session/document-commands";
import { useDocumentSession } from "./features/session/useDocumentSession";
import {
  createPlatformAdapters,
  type PlatformAdapters,
} from "./platform";

const THEME_STORAGE_KEY = "madinah-writer-theme";
const THEME_STORAGE_VERSION_KEY = "madinah-writer-theme-version";
const THEME_STORAGE_VERSION = "2";
const FILE_TREE_ROOT_STORAGE_KEY = "madinah-writer-file-tree-root";
const DOCUMENT_STATUSES: DocumentStatus[] = [
  "draft",
  "WIP",
  "published",
  "archived",
];
const WINDOW_DRAG_IGNORE_SELECTOR =
  "button, a, input, textarea, select, [role='button'], [data-tauri-no-drag]";

type WriterTheme = "dark" | "light";

type SidebarTreeNode =
  | {
      id: string;
      kind: "folder";
      label: string;
      children: SidebarTreeNode[];
    }
  | {
      id: string;
      kind: "document";
      label: string;
      detail: string;
      document: MarkdownDocument;
    };

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
  const sidebarTree = useMemo(
    () => buildSidebarTree(visibleDocuments),
    [visibleDocuments],
  );
  const folderIds = useMemo(() => collectFolderIds(sidebarTree), [sidebarTree]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(["root"]),
  );
  const [fileTreeRoot, setFileTreeRoot] = useState<string | null>(() =>
    window.localStorage.getItem(FILE_TREE_ROOT_STORAGE_KEY),
  );
  const [fileTreeNodes, setFileTreeNodes] = useState<FileTreeNode[]>([]);
  const [expandedFileTreePaths, setExpandedFileTreePaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [fileTreeStatus, setFileTreeStatus] = useState("Open a folder");
  const fileTreeRef = useRef<TreeApi<FileTreeNode> | null>(null);
  const showsFileDetails = true;
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isInspectorVisible, setIsInspectorVisible] = useState(true);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
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
  const quickOpenItems = useMemo(
    () =>
      buildQuickOpenItems({
        documents: visibleDocuments,
        fileTreeNodes,
        workspaceRoot: fileTreeRoot,
      }),
    [fileTreeNodes, fileTreeRoot, visibleDocuments],
  );
  const quickOpenResults = useMemo(
    () => searchQuickOpenItems(quickOpenItems, quickOpenQuery).slice(0, 12),
    [quickOpenItems, quickOpenQuery],
  );
  const historyTargetId = session.document
    ? getVersionTargetId(session.document, session.filePath)
    : null;
  const documentStatus = getDocumentStatusLabel(status, session.isDirty);
  const aiPolishCommand = useMemo(
    () =>
      createAiPolishCommand({
        aiPolish: platform.aiPolish,
        settings: acpSettings,
        setStatus,
      }),
    [acpSettings, platform.aiPolish, setStatus],
  );
  const commandRegistry = useMemo(
    () =>
      new CommandRegistry(
        [
          ...(engine.profile.commands ?? []),
          aiPolishCommand,
          ...createDocumentCommands({
            open: openFromDialog,
            save: saveNow,
            saveAs,
            revert,
            close,
          }),
        ],
        engine.profile.slashCommands ?? [],
      ),
    [
      aiPolishCommand,
      close,
      engine.profile.commands,
      engine.profile.slashCommands,
      openFromDialog,
      revert,
      saveAs,
      saveNow,
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
    async (root = fileTreeRoot) => {
      if (!platform.fileTreeStore.isAvailable || !root) {
        setFileTreeNodes([]);
        setFileTreeStatus(
          platform.fileTreeStore.isAvailable ? "Open a folder" : "使用桌面版打开文件夹",
        );
        return;
      }

      try {
        setFileTreeStatus("Loading");
        const nodes = await platform.fileTreeStore.listTree(root);
        setFileTreeNodes(nodes);
        setFileTreeStatus(nodes.length > 0 ? "Ready" : "No Markdown files");
      } catch (error: unknown) {
        setFileTreeNodes([]);
        setFileTreeStatus(String(error));
      }
    },
    [fileTreeRoot, platform.fileTreeStore],
  );
  const openWorkspaceFolder = useCallback(async () => {
    const root = await platform.windowAdapter.openDirectory({
      title: "Open Folder",
    });
    if (!root) return;

    window.localStorage.setItem(FILE_TREE_ROOT_STORAGE_KEY, root);
    setFileTreeRoot(root);
    setExpandedFileTreePaths(new Set());
    await loadFileTree(root);
  }, [loadFileTree, platform.windowAdapter]);
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
      if (!fileTreeRoot) return;
      try {
        const created =
          kind === "file"
            ? await platform.fileTreeStore.createFile(parentPath, "Untitled.md")
            : await platform.fileTreeStore.createDirectory(
                parentPath,
                "New Folder",
              );
        if (parentPath !== fileTreeRoot) {
          setExpandedFileTreePaths((current) =>
            new Set(current).add(parentPath),
          );
          fileTreeRef.current?.open(parentPath);
        }
        await loadFileTree();
        // Let react-arborist render the new node before entering rename mode.
        requestAnimationFrame(() => {
          void fileTreeRef.current?.edit(created.path);
        });
      } catch (error: unknown) {
        setStatus(String(error));
      }
    },
    [fileTreeRoot, loadFileTree, platform.fileTreeStore, setStatus],
  );
  const handleNewFile = useCallback(() => {
    if (fileTreeRoot) void createInTree(fileTreeRoot, "file");
  }, [createInTree, fileTreeRoot]);
  const handleNewFolder = useCallback(() => {
    if (fileTreeRoot) void createInTree(fileTreeRoot, "directory");
  }, [createInTree, fileTreeRoot]);
  const handleRename = useCallback(
    async (path: string, name: string) => {
      if (!fileTreeRoot) return;
      try {
        if (session.filePath === path && session.isDirty) {
          await saveNow();
        }
        const renamed = await platform.fileTreeStore.renamePath(path, name);
        await loadFileTree();
        if (session.filePath === path && renamed.kind === "file") {
          await openMarkdownPath(renamed.path);
        }
      } catch (error: unknown) {
        setStatus(String(error));
      }
    },
    [
      fileTreeRoot,
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
      if (!fileTreeRoot) return;

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
            toRelativePath(fileTreeRoot, node.path),
          );
          setStatus("Relative path copied");
          return;
        }

        if (action === "duplicate" && node.kind === "file") {
          const file = await platform.fileTreeStore.duplicateFile(node.path);
          await loadFileTree();
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
          await platform.fileTreeStore.moveToTrash(fileTreeRoot, node.path);
          await loadFileTree();
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
      fileTreeRoot,
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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(THEME_STORAGE_VERSION_KEY, THEME_STORAGE_VERSION);
  }, [theme]);

  useEffect(() => {
    setVersions(historyTargetId ? historyStore.list(historyTargetId) : []);
  }, [historyStore, historyTargetId]);

  useEffect(() => {
    void loadFileTree();
  }, [loadFileTree]);

  useEffect(() => {
    if (!platform.fileTreeStore.isAvailable || !fileTreeRoot) return;

    let dispose: (() => void) | null = null;
    let active = true;

    void platform.fileTreeStore
      .watchTree(fileTreeRoot, () => {
        // Don't yank the tree out from under an in-progress inline rename.
        if (fileTreeRef.current?.editingId) return;
        void loadFileTree();
      })
      .then((unwatch) => {
        if (active) {
          dispose = unwatch;
          return;
        }
        unwatch();
      })
      .catch(() => {});

    return () => {
      active = false;
      dispose?.();
    };
  }, [fileTreeRoot, loadFileTree, platform.fileTreeStore]);

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
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) return;

      const key = event.key.toLowerCase();
      if (key === "p") {
        event.preventDefault();
        setIsQuickOpenOpen(true);
        return;
      }

      if (key === "n") {
        event.preventDefault();
        void createNewDocument();
        return;
      }

      const commandId =
        key === "o"
          ? "document.open"
          : key === "s" && event.shiftKey
            ? "document.saveAs"
            : key === "s"
              ? "document.save"
              : key === "w"
                ? "document.close"
                : null;

      if (!commandId) return;

      event.preventDefault();
      runCommand(commandId);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createNewDocument, runCommand]);

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
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Madinah Writer"
      >
        <header
          className="writer-titlebar"
          data-tauri-drag-region
          onPointerDown={startWindowDrag}
        >
          <div className="writer-titlebar-title" data-tauri-drag-region>
            <strong data-tauri-drag-region>{documentTitle}</strong>
            <span className="writer-titlebar-file" data-tauri-drag-region>
              {documentStatus}
            </span>
          </div>

          <div className="writer-titlebar-meta">
            <span className="writer-word-count" data-tauri-drag-region>
              {formatWordCount(metrics.words)}
            </span>
            <button
              type="button"
              className="writer-sidebar-toggle"
              data-tauri-no-drag
              aria-label="Quick open"
              title="Quick open"
              onClick={() => setIsQuickOpenOpen(true)}
            >
              <Search size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="writer-sidebar-toggle"
              data-tauri-no-drag
              aria-label="AI settings"
              title="AI settings"
              onClick={() => setIsAcpSettingsOpen(true)}
            >
              <Settings size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="writer-theme-toggle"
              data-tauri-no-drag
              aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
              title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
              onClick={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button
              type="button"
              className={`writer-sidebar-toggle${isInspectorVisible ? " is-active" : ""}`}
              data-tauri-no-drag
              aria-label={isInspectorVisible ? "隐藏属性面板" : "显示属性面板"}
              title={isInspectorVisible ? "隐藏属性面板" : "显示属性面板"}
              onClick={() => setIsInspectorVisible((current) => !current)}
            >
              <SlidersHorizontal size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`writer-sidebar-toggle${isSidebarVisible ? " is-active" : ""}`}
              data-tauri-no-drag
              aria-label={isSidebarVisible ? "隐藏侧边栏" : "显示侧边栏"}
              title={isSidebarVisible ? "隐藏侧边栏" : "显示侧边栏"}
              onClick={() => setIsSidebarVisible((current) => !current)}
            >
              <PanelRight size={15} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="writer-workbench">
          {isSidebarVisible ? (
            platform.fileTreeStore.isAvailable ? (
              <FileTreeSidebar
                activePath={session.filePath}
                expandedPaths={expandedFileTreePaths}
                isAvailable={platform.fileTreeStore.isAvailable}
                nodes={fileTreeNodes}
                root={fileTreeRoot}
                status={fileTreeStatus}
                treeRef={fileTreeRef}
                onAction={(action, node) => void runFileTreeAction(action, node)}
                onNewFile={handleNewFile}
                onNewFolder={handleNewFolder}
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

          <section className="writer-simple-canvas" aria-label="Editor">
            {session.document ? (
              <MarkdownEditor
                key={session.document.id}
                value={session.document.body}
                document={session.document}
                workspace={session.workspace}
                editorPlugins={engine.profile.editorPlugins ?? []}
                commandRegistry={commandRegistry}
                contextMenuItems={[
                  {
                    id: "ai-polish",
                    label: "AI Polish",
                    commandId: AI_POLISH_COMMAND_ID,
                  },
                ]}
                onChange={changeSource}
                onError={(error) => setStatus(error)}
              />
            ) : (
              <div className="writer-empty-state">{status}</div>
            )}
          </section>

          {isInspectorVisible && session.document ? (
            <DocumentInspector
              document={session.document}
              versions={versions}
              onMetadataChange={changeMetadata}
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

function DocumentInspector({
  document,
  versions,
  onMetadataChange,
  onSaveVersion,
  onRestoreVersion,
}: {
  document: MarkdownDocument;
  versions: DocumentVersion[];
  onMetadataChange: (patch: DocumentMetadataPatch) => void;
  onSaveVersion: () => void;
  onRestoreVersion: (version: DocumentVersion) => void;
}) {
  const [tagsInput, setTagsInput] = useState(document.tags.join(", "));
  const metrics = useMemo(
    () => getDocumentMetrics(document.body),
    [document.body],
  );

  useEffect(() => {
    setTagsInput(document.tags.join(", "));
  }, [document.id, document.tags]);

  return (
    <aside className="writer-inspector" aria-label="Document properties">
      <section className="inspector-section">
        <div className="inspector-section-header">
          <span>Properties</span>
        </div>
        <label className="inspector-field">
          <span>Title</span>
          <MagicInput
            value={document.title}
            onChange={(event) =>
              onMetadataChange({ title: event.currentTarget.value })
            }
          />
        </label>
        <label className="inspector-field">
          <span>Description</span>
          <MagicTextarea
            rows={3}
            value={document.description}
            onChange={(event) =>
              onMetadataChange({ description: event.currentTarget.value })
            }
          />
        </label>
        <label className="inspector-field">
          <span>Tags</span>
          <MagicInput
            value={tagsInput}
            onChange={(event) => setTagsInput(event.currentTarget.value)}
            onBlur={() => onMetadataChange({ tags: tagsInput })}
          />
        </label>
        <div className="inspector-grid">
          <label className="inspector-field">
            <span>Status</span>
            <MagicSelect
              value={document.status}
              onChange={(event) =>
                onMetadataChange({
                  status: event.currentTarget.value as DocumentStatus,
                })
              }
            >
              {DOCUMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </MagicSelect>
          </label>
          <label className="inspector-field">
            <span>Author</span>
            <MagicInput
              value={document.author}
              onChange={(event) =>
                onMetadataChange({ author: event.currentTarget.value })
              }
            />
          </label>
        </div>
        <label className="inspector-field">
          <span>Publish date</span>
          <MagicInput
            value={document.pubDate}
            onChange={(event) =>
              onMetadataChange({ pubDate: event.currentTarget.value })
            }
          />
        </label>
      </section>

      <section className="inspector-section">
        <div className="inspector-section-header">
          <span>Writing</span>
        </div>
        <div className="inspector-stat-grid" aria-label="Writing metrics">
          <div className="inspector-stat-card">
            <span>Words</span>
            <strong>
              <NumberTicker value={metrics.words} />
            </strong>
          </div>
          <div className="inspector-stat-card">
            <span>Characters</span>
            <strong>
              <NumberTicker value={metrics.characters} />
            </strong>
          </div>
          <div className="inspector-stat-card">
            <span>Blocks</span>
            <strong>
              <NumberTicker value={metrics.blocks} />
            </strong>
          </div>
        </div>
      </section>

      <section className="inspector-section">
        <div className="inspector-section-header">
          <span>History</span>
          <MagicButton type="button" onClick={onSaveVersion}>
            Save version
          </MagicButton>
        </div>
        {versions.length > 0 ? (
          <AnimatedList key={document.id} className="version-list" delay={45}>
            {versions.map((version) => (
              <div className="version-row" key={version.id}>
                <Clock3 size={14} aria-hidden="true" />
                <span>
                  <strong>{version.title || "Untitled"}</strong>
                  <small>
                    {formatVersionTimestamp(version.createdAt)} / {version.reason}
                  </small>
                </span>
                <button type="button" onClick={() => onRestoreVersion(version)}>
                  Restore
                </button>
              </div>
            ))}
          </AnimatedList>
        ) : (
          <div className="version-empty">No versions saved</div>
        )}
      </section>
    </aside>
  );
}

function formatVersionTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getInitialTheme(): WriterTheme {
  const version = window.localStorage.getItem(THEME_STORAGE_VERSION_KEY);
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (version === THEME_STORAGE_VERSION && (saved === "dark" || saved === "light")) {
    return saved;
  }

  return "dark";
}

function mergeActiveDocument(
  documents: MarkdownDocument[],
  document: MarkdownDocument | null,
): MarkdownDocument[] {
  if (!document) return documents;

  return sortDocuments(
    documents.some((item) => item.id === document.id)
      ? documents.map((item) => (item.id === document.id ? document : item))
      : [...documents, document],
  );
}

function sortDocuments(documents: MarkdownDocument[]): MarkdownDocument[] {
  return [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getDocumentDisplayTitle(document: MarkdownDocument): string {
  const heading = extractDocumentTitle(document.body);
  if (heading && heading !== "Untitled") return heading;

  return document.title || "Untitled";
}

function getDocumentFileName(
  document: MarkdownDocument,
  filePath: string | null,
): string {
  if (filePath) {
    return filePath.split(/[\\/]/).pop() || `${document.slug}.md`;
  }

  return `${document.slug || "untitled"}.md`;
}

function getDocumentStatusLabel(status: string, isDirty: boolean): string {
  if (isDirty || status === "Unsaved changes") return "Edited";
  if (status === "Saving") return "Saving";
  if (status === "Opening") return "Opening";
  if (status === "Creating") return "Creating";
  if (status === "Ready" || status === "Saved" || status === "Draft saved") {
    return "Saved";
  }

  return status;
}

function getDocumentMetrics(source: string): {
  characters: number;
  blocks: number;
  words: number;
} {
  const content = stripFrontmatter(source);
  const readableText = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^[#>\s-]+/gm, "")
    .replace(/[>*_~`[\](){}|\\-]/g, " ")
    .replace(/\s+/g, "");
  const words =
    content.match(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[\p{Letter}\p{Number}]+(?:['’-][\p{Letter}\p{Number}]+)*/gu,
    )?.length ?? 0;
  const blocks = content
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean).length;

  return {
    characters: readableText.length,
    blocks,
    words,
  };
}

function stripFrontmatter(source: string): string {
  return source.replace(/^---[\s\S]*?\n---\s*/u, "");
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "今天";

  const today = startOfDay(new Date()).getTime();
  const target = startOfDay(date).getTime();
  const days = Math.max(0, Math.round((today - target) / 86_400_000));

  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  if (days < 14) return "上周";

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildSidebarTree(documents: MarkdownDocument[]): SidebarTreeNode[] {
  const grouped = new Map<string, MarkdownDocument[]>();

  for (const document of documents) {
    const group = formatTreeDate(document.updatedAt);
    grouped.set(group, [...(grouped.get(group) ?? []), document]);
  }

  const children = [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, items]) => ({
      id: `folder-${date}`,
      kind: "folder" as const,
      label: date,
      children: sortDocuments(items).map((document) => ({
        id: document.id,
        kind: "document" as const,
        label: getDocumentDisplayTitle(document),
        detail: getDocumentFileName(document, null),
        document,
      })),
    }));

  return [
    {
      id: "root",
      kind: "folder",
      label: "Codex",
      children,
    },
  ];
}

function collectFolderIds(nodes: SidebarTreeNode[]): string[] {
  return nodes.flatMap((node) => {
    if (node.kind === "document") return [];
    return [node.id, ...collectFolderIds(node.children)];
  });
}

function formatTreeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Drafts";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatWordCount(words: number): string {
  return `${words} ${words === 1 ? "Word" : "Words"}`;
}

function pathContains(parent: string, child: string | null): boolean {
  if (!child) return false;
  return child === parent || child.startsWith(`${parent}/`) || child.startsWith(`${parent}\\`);
}

function toRelativePath(root: string, path: string): string {
  if (path === root) return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
  for (const separator of ["/", "\\"]) {
    const prefix = `${root}${separator}`;
    if (path.startsWith(prefix)) return path.slice(prefix.length);
  }
  return path;
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

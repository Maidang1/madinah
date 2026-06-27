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
  FileCode2,
  Folder,
  PanelRight,
} from "lucide-react";
import type { TreeApi } from "react-arborist";
import {
  extractDocumentTitle,
  type MarkdownDocument,
} from "./domain/document";
import {
  WRITER_COMMAND_EVENT,
  getWriterCommandIdFromPayload,
} from "./features/commands/native-menu";
import { MarkdownEditor } from "./features/editor/MarkdownEditor";
import { CommandRegistry } from "./features/engine/CommandRegistry";
import { EngineProvider, useEngine } from "./features/engine/EngineProvider";
import { FileTreeSidebar } from "./features/file-tree/FileTreeSidebar";
import {
  type FileTreeMenuAction,
  type FileTreeNode,
} from "./features/file-tree/file-tree";
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
  const [theme, setTheme] = useState<WriterTheme>(getInitialTheme);
  const documentTitle = session.document
    ? getDocumentDisplayTitle(session.document)
    : "Madinah Writer";
  const metrics = useMemo(
    () => getDocumentMetrics(session.document?.body ?? ""),
    [session.document?.body],
  );
  const documentStatus = getDocumentStatusLabel(status, session.isDirty);
  const commandRegistry = useMemo(
    () =>
      new CommandRegistry(
        [
          ...(engine.profile.commands ?? []),
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
      close,
      engine.profile.commands,
      engine.profile.slashCommands,
      openFromDialog,
      revert,
      saveAs,
      saveNow,
    ],
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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(THEME_STORAGE_VERSION_KEY, THEME_STORAGE_VERSION);
  }, [theme]);

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
        className={`writer-window${isSidebarVisible ? "" : " is-sidebar-hidden"}`}
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
                onChange={changeSource}
                onError={(error) => setStatus(error)}
              />
            ) : (
              <div className="writer-empty-state">{status}</div>
            )}
          </section>
        </div>
      </section>
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

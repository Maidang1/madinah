import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  RefreshCw,
} from "lucide-react";
import {
  memo,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type RefObject,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Tree, type NodeRendererProps, type TreeApi } from "react-arborist";
import {
  filterFileTreeDrafts,
  getArboristOpenState,
  getContextMenuPosition,
  getFileTreeFileMarker,
  getFileTreeDraftMenuItems,
  getFileTreeMenuItems,
  type FileTreeActiveFileState,
  type FileTreeDraftAction,
  type FileTreeDraftItem,
  type FileTreeFileMarker,
  type FileTreeMenuAction,
  type FileTreeNode,
} from "./file-tree";

interface FileTreeSidebarProps {
  activeFileState: FileTreeActiveFileState;
  activePath: string | null;
  activeDocumentId: string | null;
  drafts: FileTreeDraftItem[];
  expandedPaths: Set<string>;
  isAvailable: boolean;
  nodes: FileTreeNode[];
  roots: string[];
  status: string;
  treeRef: RefObject<TreeApi<FileTreeNode> | null>;
  onAction: (action: FileTreeMenuAction, node: FileTreeNode) => void;
  onDraftAction: (action: FileTreeDraftAction, draft: FileTreeDraftItem) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onOpenDraft: (id: string) => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
  onRename: (path: string, name: string) => void;
  onToggleDirectory: (path: string) => void;
}

type ContextMenuState =
  | {
      kind: "file";
      node: FileTreeNode;
      position: {
        x: number;
        y: number;
      };
    }
  | {
      kind: "draft";
      draft: FileTreeDraftItem;
      position: {
        x: number;
        y: number;
      };
    };

export function FileTreeSidebar({
  activeFileState,
  activePath,
  activeDocumentId,
  drafts,
  expandedPaths,
  isAvailable,
  nodes,
  roots,
  status,
  treeRef,
  onAction,
  onDraftAction,
  onNewFile,
  onNewFolder,
  onOpenDraft,
  onOpenFile,
  onOpenFolder,
  onRefresh,
  onRename,
  onToggleDirectory,
}: FileTreeSidebarProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const initialOpenState = useMemo(
    () => getArboristOpenState(nodes, expandedPaths),
    [expandedPaths, nodes],
  );
  const visibleDrafts = useMemo(
    () => filterFileTreeDrafts(drafts, searchTerm),
    [drafts, searchTerm],
  );

  useEffect(() => {
    if (!contextMenu) return;

    const close = () => setContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("click", close);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  const openContextMenu = (event: MouseEvent, node: FileTreeNode) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      kind: "file",
      node,
      position: getContextMenuPosition(
        event,
        { width: 220, height: node.kind === "directory" ? 296 : 296 },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    });
  };
  const openDraftContextMenu = (event: MouseEvent, draft: FileTreeDraftItem) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      kind: "draft",
      draft,
      position: getContextMenuPosition(
        event,
        { width: 180, height: 146 },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    });
  };

  return (
    <aside className="writer-sidebar" aria-label="文稿列表">
      <div className="writer-sidebar-header" data-tauri-drag-region>
        <span>{roots.length > 0 ? `${roots.length} FOLDERS` : "FILES"}</span>
        <div className="writer-sidebar-actions">
          <button
            type="button"
            className="writer-sidebar-icon-button"
            aria-label="新建文件"
            title="新建文件"
            disabled={roots.length === 0 || !isAvailable}
            onClick={onNewFile}
          >
            <FilePlus size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="writer-sidebar-icon-button"
            aria-label="新建文件夹"
            title="新建文件夹"
            disabled={roots.length === 0 || !isAvailable}
            onClick={onNewFolder}
          >
            <FolderPlus size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="writer-sidebar-icon-button"
            aria-label="添加文件夹"
            title="添加文件夹"
            onClick={onOpenFolder}
          >
            <FolderOpen size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="writer-sidebar-icon-button"
            aria-label="刷新文件树"
            title="刷新文件树"
            disabled={roots.length === 0 || !isAvailable}
            onClick={onRefresh}
          >
            <RefreshCw size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {!isAvailable ? (
        <div className="file-tree-message">使用桌面版打开文件夹</div>
      ) : roots.length === 0 && drafts.length === 0 ? (
        <div className="file-tree-message">
          <button type="button" onClick={onOpenFolder}>
            Add Folder
          </button>
        </div>
      ) : (
        <>
          <div className="file-tree-search-row">
            <input
              type="search"
              className="file-tree-search"
              placeholder="筛选文件或草稿…"
              aria-label="筛选文件或草稿"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          {visibleDrafts.length > 0 ? (
            <section className="file-tree-drafts" aria-label="Drafts">
              <div className="file-tree-section-title">DRAFTS</div>
              <div className="file-tree-draft-list">
                {visibleDrafts.map((draft) => (
                  <button
                    key={draft.id}
                    type="button"
                    className={`tree-row is-file file-tree-draft-row${
                      draft.id === activeDocumentId ? " is-active" : ""
                    }`}
                    style={{ "--tree-depth": 0 } as CSSProperties}
                    aria-current={draft.id === activeDocumentId ? "page" : undefined}
                    onClick={() => onOpenDraft(draft.id)}
                    onContextMenu={(event) => openDraftContextMenu(event, draft)}
                  >
                    <FileCode2 className="tree-icon" size={15} aria-hidden="true" />
                    <span className="tree-copy">
                      <span className="tree-label">{draft.title}</span>
                      <small>{draft.detail}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          {roots.length === 0 ? null : nodes.length === 0 ? (
            <div className="file-tree-message">{status}</div>
          ) : (
            <div className="file-tree" aria-label="Files">
              <Tree<FileTreeNode>
                ref={treeRef}
                data={nodes}
                idAccessor="path"
                childrenAccessor="children"
                selection={activePath ?? undefined}
                initialOpenState={initialOpenState}
                openByDefault={false}
                width="100%"
                height={Math.max(240, window.innerHeight - 92)}
                indent={16}
                rowHeight={30}
                overscanCount={8}
                searchTerm={searchTerm}
                searchMatch={(node, term) =>
                  node.data.name.toLowerCase().includes(term.toLowerCase())
                }
                disableDrag
                disableDrop
                disableMultiSelection
                onActivate={(node) => {
                  if (node.isEditing) return;
                  if (node.data.kind === "file") {
                    onOpenFile(node.data.path);
                  } else {
                    node.toggle();
                  }
                }}
                onToggle={onToggleDirectory}
                onRename={({ id, name, node }) => {
                  const trimmed = name.trim();
                  if (!trimmed || trimmed === node.data.name) return;
                  onRename(id, trimmed);
                }}
              >
                {(props) => (
                  <FileTreeNodeRow
                    {...props}
                    activeFileState={activeFileState}
                    onContextMenu={openContextMenu}
                    onOpenFile={onOpenFile}
                  />
                )}
              </Tree>
            </div>
          )}
        </>
      )}

      {contextMenu?.kind === "file" ? (
        <FileTreeContextMenu
          node={contextMenu.node}
          position={contextMenu.position}
          onAction={(action, node) => {
            setContextMenu(null);
            onAction(action, node);
          }}
        />
      ) : null}
      {contextMenu?.kind === "draft" ? (
        <FileTreeDraftContextMenu
          draft={contextMenu.draft}
          position={contextMenu.position}
          onAction={(action, draft) => {
            setContextMenu(null);
            onDraftAction(action, draft);
          }}
        />
      ) : null}
    </aside>
  );
}

const FileTreeNodeRow = memo(function FileTreeNodeRow({
  activeFileState,
  node,
  style,
  onContextMenu,
  onOpenFile,
}: NodeRendererProps<FileTreeNode> & {
  activeFileState: FileTreeActiveFileState;
  onContextMenu: (event: MouseEvent, node: FileTreeNode) => void;
  onOpenFile: (path: string) => void;
}) {
  const isDirectory = node.data.kind === "directory";
  const marker = isDirectory
    ? null
    : getFileTreeFileMarker(node.data.path, activeFileState);
  const rowStyle = getFileTreeRowStyle(style as CSSProperties, node.level);

  if (node.isEditing) {
    const commit = (value: string) => {
      const trimmed = value.trim();
      if (trimmed) {
        node.submit(trimmed);
      } else {
        node.reset();
      }
    };
    const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit(event.currentTarget.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        node.reset();
      }
    };

    return (
      <div
        className={`tree-row ${isDirectory ? "is-folder" : "is-file"}${
          node.data.isRoot ? " is-root" : ""
        } is-editing`}
        style={rowStyle}
      >
        {isDirectory ? (
          <ChevronRight className="tree-chevron" size={14} aria-hidden="true" />
        ) : null}
        {isDirectory ? (
          <Folder className="tree-icon" size={16} aria-hidden="true" />
        ) : (
          <FileCode2 className="tree-icon" size={15} aria-hidden="true" />
        )}
        <input
          className="tree-row-edit-input"
          autoFocus
          defaultValue={node.data.name}
          aria-label="名称"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={handleKeyDown}
          onBlur={(event) => commit(event.currentTarget.value)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`tree-row ${isDirectory ? "is-folder" : "is-file"}${
        node.isSelected ? " is-active" : ""
      }${node.data.isRoot ? " is-root" : ""}${marker ? " has-file-marker" : ""}`}
      style={rowStyle}
      aria-current={node.isSelected ? "page" : undefined}
      aria-expanded={isDirectory ? node.isOpen : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (isDirectory) {
          node.toggle();
        } else {
          onOpenFile(node.data.path);
        }
      }}
      onContextMenu={(event) => onContextMenu(event, node.data)}
    >
      {isDirectory ? (
        node.isOpen ? (
          <ChevronDown className="tree-chevron" size={14} aria-hidden="true" />
        ) : (
          <ChevronRight className="tree-chevron" size={14} aria-hidden="true" />
        )
      ) : null}
      {isDirectory ? (
        node.data.isRoot ? (
          <FolderOpen className="tree-icon" size={16} aria-hidden="true" />
        ) : (
          <Folder className="tree-icon" size={16} aria-hidden="true" />
        )
      ) : (
        <FileCode2 className="tree-icon" size={15} aria-hidden="true" />
      )}
      <span className="tree-copy">
        <span className="tree-label">{node.data.name}</span>
        {isDirectory ? (
          <small>{node.data.childrenCount} items</small>
        ) : null}
      </span>
      {marker ? <FileTreeFileMarkerView marker={marker} /> : null}
    </button>
  );
});

function FileTreeFileMarkerView({ marker }: { marker: FileTreeFileMarker }) {
  const label = marker === "draft-saved" ? "恢复草稿已保存" : "已编辑";

  return (
    <span
      className={`file-tree-file-marker is-${marker}`}
      role="img"
      aria-label={label}
      title={label}
    />
  );
}

function FileTreeContextMenu({
  node,
  position,
  onAction,
}: {
  node: FileTreeNode;
  position: {
    x: number;
    y: number;
  };
  onAction: (action: FileTreeMenuAction, node: FileTreeNode) => void;
}) {
  const items = getFileTreeMenuItems(node);

  return (
    <div
      className="file-tree-context-menu"
      style={{ left: position.x, top: position.y }}
      role="menu"
      aria-label={`${node.name} actions`}
      onClick={(event) => event.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          onClick={() => onAction(item.id, node)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function FileTreeDraftContextMenu({
  draft,
  position,
  onAction,
}: {
  draft: FileTreeDraftItem;
  position: {
    x: number;
    y: number;
  };
  onAction: (action: FileTreeDraftAction, draft: FileTreeDraftItem) => void;
}) {
  const items = getFileTreeDraftMenuItems(draft);

  return (
    <div
      className="file-tree-context-menu file-tree-draft-context-menu"
      style={{ left: position.x, top: position.y }}
      role="menu"
      aria-label={`${draft.title} actions`}
      onClick={(event) => event.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          onClick={() => onAction(item.id, draft)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function getFileTreeRowStyle(style: CSSProperties, level: number): CSSProperties {
  const rowStyle = {
    ...style,
    "--tree-depth": level,
  } as CSSProperties & { "--tree-depth": number };

  delete rowStyle.paddingLeft;
  return rowStyle;
}

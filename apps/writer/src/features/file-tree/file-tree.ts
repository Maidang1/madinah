export type FileTreeNodeKind = "directory" | "file";

export interface FileTreeNode {
  path: string;
  name: string;
  kind: FileTreeNodeKind;
  childrenCount: number;
  children: FileTreeNode[];
  isRoot?: boolean;
}

export interface FileTreeDraftItem {
  id: string;
  title: string;
  detail: string;
  status: string;
}

export interface VisibleFileTreeNode extends FileTreeNode {
  depth: number;
  isActive: boolean;
  isExpanded: boolean;
}

export type FileTreeMenuAction =
  | "open"
  | "new-file"
  | "new-folder"
  | "toggle"
  | "rename"
  | "duplicate"
  | "save-as"
  | "reveal-in-finder"
  | "copy-path"
  | "copy-relative-path"
  | "move-to-trash";

export type FileTreeDraftAction =
  | "open"
  | "publish"
  | "mark-wip"
  | "archive"
  | "delete";

export interface FileTreeMenuItem {
  id: FileTreeMenuAction;
  label: string;
}

export interface FileTreeDraftMenuItem {
  id: FileTreeDraftAction;
  label: string;
}

export interface FileTreeRoot {
  path: string;
  nodes: FileTreeNode[];
}

interface FlattenInput {
  nodes: FileTreeNode[];
  expandedPaths: Set<string>;
  activePath: string | null;
}

interface PointerPosition {
  clientX: number;
  clientY: number;
}

interface Size {
  width: number;
  height: number;
}

export function flattenVisibleFileTree({
  activePath,
  expandedPaths,
  nodes,
}: FlattenInput): VisibleFileTreeNode[] {
  const rows: VisibleFileTreeNode[] = [];

  for (const node of nodes) {
    appendVisibleNode(rows, node, 0, expandedPaths, activePath);
  }

  return rows;
}

export function collectDirectoryPaths(nodes: FileTreeNode[]): string[] {
  return nodes.flatMap((node) => {
    if (node.kind !== "directory") return [];
    return [node.path, ...collectDirectoryPaths(node.children)];
  });
}

export function getArboristOpenState(
  nodes: FileTreeNode[],
  expandedPaths: Set<string>,
): Record<string, boolean> {
  const openState: Record<string, boolean> = {};

  for (const node of nodes) {
    appendOpenState(openState, node, expandedPaths);
  }

  return openState;
}

export function buildFileTreeRootNodes(roots: FileTreeRoot[]): FileTreeNode[] {
  return roots.map((root) => ({
    path: root.path,
    name: getFileTreeRootName(root.path),
    kind: "directory",
    childrenCount: root.nodes.length,
    children: root.nodes,
    isRoot: true,
  }));
}

export function addFileTreeRoot(roots: string[], root: string): string[] {
  return uniqueFileTreeRoots([...roots, root]);
}

export function parseFileTreeRoots(
  value: string | null,
  legacyRoot?: string | null,
): string[] {
  const parsed = parseStoredRoots(value);
  if (parsed.length > 0) return parsed;
  return uniqueFileTreeRoots(legacyRoot ? [legacyRoot] : []);
}

export function serializeFileTreeRoots(roots: string[]): string {
  return JSON.stringify(uniqueFileTreeRoots(roots));
}

export function findFileTreeRootForPath(
  roots: string[],
  path: string | null,
): string | null {
  if (!path) return null;

  return (
    roots
      .filter((root) => pathContains(root, path))
      .sort((left, right) => right.length - left.length)[0] ?? null
  );
}

export function getActiveFileTreeRoot(
  roots: string[],
  activePath: string | null,
): string | null {
  return findFileTreeRootForPath(roots, activePath) ?? roots.at(-1) ?? null;
}

export function getFileTreeStatus(
  roots: string[],
  statuses: Record<string, string>,
  isAvailable: boolean,
): string {
  if (!isAvailable) return "使用桌面版打开文件夹";
  if (roots.length === 0) return "Open a folder";
  if (roots.some((root) => statuses[root] === "Loading")) return "Loading";

  const failures = roots
    .map((root) => statuses[root])
    .filter(
      (status) =>
        status && status !== "Ready" && status !== "No Markdown files",
    );

  if (failures.length === 1) return failures[0];
  if (failures.length > 1) return `${failures.length} folders failed`;
  if (roots.every((root) => statuses[root] === "No Markdown files")) {
    return "No Markdown files";
  }

  return "Ready";
}

export function getContextMenuPosition(
  pointer: PointerPosition,
  menu: Size,
  viewport: Size,
): { x: number; y: number } {
  const padding = 8;
  const maxX = Math.max(padding, viewport.width - menu.width - padding);
  const maxY = Math.max(padding, viewport.height - menu.height - padding);

  return {
    x: Math.min(Math.max(pointer.clientX, padding), maxX),
    y: Math.min(Math.max(pointer.clientY, padding), maxY),
  };
}

export function getFileTreeMenuItems(node: FileTreeNode): FileTreeMenuItem[] {
  if (node.kind === "directory") {
    const items: FileTreeMenuItem[] = [
      { id: "new-file", label: "New Markdown File" },
      { id: "new-folder", label: "New Folder" },
      { id: "toggle", label: "Expand / Collapse" },
      { id: "reveal-in-finder", label: "Reveal in Finder" },
      { id: "copy-path", label: "Copy Path" },
    ];

    if (node.isRoot) return items;

    return [
      ...items.slice(0, 3),
      { id: "rename", label: "Rename" },
      ...items.slice(3),
      { id: "copy-relative-path", label: "Copy Relative Path" },
      { id: "move-to-trash", label: "Move to Trash" },
    ];
  }

  return [
    { id: "open", label: "Open" },
    { id: "rename", label: "Rename" },
    { id: "duplicate", label: "Duplicate" },
    { id: "save-as", label: "Save As..." },
    { id: "reveal-in-finder", label: "Reveal in Finder" },
    { id: "copy-path", label: "Copy Path" },
    { id: "copy-relative-path", label: "Copy Relative Path" },
    { id: "move-to-trash", label: "Move to Trash" },
  ];
}

export function getFileTreeDraftMenuItems(
  draft: FileTreeDraftItem,
): FileTreeDraftMenuItem[] {
  const statusAction =
    draft.status === "published"
      ? { id: "mark-wip" as const, label: "Mark as WIP" }
      : { id: "publish" as const, label: "Publish" };

  return [
    { id: "open", label: "Open" },
    statusAction,
    { id: "archive", label: "Archive" },
    { id: "delete", label: "Delete" },
  ];
}

export function filterFileTreeDrafts(
  drafts: FileTreeDraftItem[],
  searchTerm: string,
): FileTreeDraftItem[] {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return drafts;

  return drafts.filter((draft) =>
    `${draft.title} ${draft.detail}`.toLowerCase().includes(query),
  );
}

export function pathContains(
  root: string,
  path: string | null | undefined,
): boolean {
  if (!path) return false;
  return path === root || path.startsWith(`${root}/`) || path.startsWith(`${root}\\`);
}

export function toRelativePath(
  root: string | null | undefined,
  path: string,
): string {
  if (!root) return path;
  for (const separator of ["/", "\\"]) {
    const prefix = `${root}${separator}`;
    if (path.startsWith(prefix)) return path.slice(prefix.length);
  }
  return path;
}

function appendVisibleNode(
  rows: VisibleFileTreeNode[],
  node: FileTreeNode,
  depth: number,
  expandedPaths: Set<string>,
  activePath: string | null,
) {
  const isExpanded = node.kind === "directory" && expandedPaths.has(node.path);
  rows.push({
    ...node,
    depth,
    isActive: node.path === activePath,
    isExpanded,
  });

  if (!isExpanded) return;

  for (const child of node.children) {
    appendVisibleNode(rows, child, depth + 1, expandedPaths, activePath);
  }
}

function appendOpenState(
  openState: Record<string, boolean>,
  node: FileTreeNode,
  expandedPaths: Set<string>,
) {
  if (node.kind !== "directory") return;

  openState[node.path] = expandedPaths.has(node.path);

  for (const child of node.children) {
    appendOpenState(openState, child, expandedPaths);
  }
}

function parseStoredRoots(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return uniqueFileTreeRoots(
        parsed.filter((item): item is string => typeof item === "string"),
      );
    }
    if (typeof parsed === "string") {
      return uniqueFileTreeRoots([parsed]);
    }
  } catch {
    return uniqueFileTreeRoots([value]);
  }

  return [];
}

function uniqueFileTreeRoots(roots: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const root of roots) {
    const trimmed = root.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }

  return unique;
}

function getFileTreeRootName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

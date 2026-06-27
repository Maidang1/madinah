export type FileTreeNodeKind = "directory" | "file";

export interface FileTreeNode {
  path: string;
  name: string;
  kind: FileTreeNodeKind;
  childrenCount: number;
  children: FileTreeNode[];
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

export interface FileTreeMenuItem {
  id: FileTreeMenuAction;
  label: string;
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
    return [
      { id: "new-file", label: "New Markdown File" },
      { id: "new-folder", label: "New Folder" },
      { id: "toggle", label: "Expand / Collapse" },
      { id: "rename", label: "Rename" },
      { id: "reveal-in-finder", label: "Reveal in Finder" },
      { id: "copy-path", label: "Copy Path" },
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

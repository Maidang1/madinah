export type EditorContextMenuItem =
  | EditorContextMenuCommandItem
  | EditorContextMenuSeparatorItem;

export interface EditorContextMenuCommandItem {
  id: string;
  label: string;
  commandId: string;
  requiresSelection?: boolean;
  disabled?: boolean;
}

export interface EditorContextMenuSeparatorItem {
  id: string;
  type: "separator";
}

interface PointerPosition {
  clientX: number;
  clientY: number;
}

interface Size {
  width: number;
  height: number;
}

const CONTEXT_MENU_WIDTH = 200;
const CONTEXT_MENU_VERTICAL_PADDING = 10;
const CONTEXT_MENU_ITEM_HEIGHT = 32;
const CONTEXT_MENU_SEPARATOR_HEIGHT = 9;

export function getEditorContextMenuPosition(
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

export function getEditorContextMenuSize(
  items: EditorContextMenuItem[],
): Size {
  return {
    width: CONTEXT_MENU_WIDTH,
    height:
      CONTEXT_MENU_VERTICAL_PADDING +
      items.reduce(
        (total, item) =>
          total +
          (isEditorContextMenuSeparator(item)
            ? CONTEXT_MENU_SEPARATOR_HEIGHT
            : CONTEXT_MENU_ITEM_HEIGHT),
        0,
      ),
  };
}

export function resolveEditorContextMenuItems(
  items: EditorContextMenuItem[],
  hasSelection: boolean,
  disabledCommandIds: readonly string[] = [],
): EditorContextMenuItem[] {
  const disabledCommandIdSet = new Set(disabledCommandIds);

  return items.map((item) => {
    if (isEditorContextMenuSeparator(item)) return item;
    if (disabledCommandIdSet.has(item.commandId)) {
      return {
        ...item,
        disabled: true,
      };
    }

    if (!item.requiresSelection || hasSelection) return item;

    return {
      ...item,
      disabled: true,
    };
  });
}

export function isEditorContextMenuSeparator(
  item: EditorContextMenuItem,
): item is EditorContextMenuSeparatorItem {
  return "type" in item && item.type === "separator";
}

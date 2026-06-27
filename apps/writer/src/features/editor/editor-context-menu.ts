export interface EditorContextMenuItem {
  id: string;
  label: string;
  commandId: string;
  disabled?: boolean;
}

interface PointerPosition {
  clientX: number;
  clientY: number;
}

interface Size {
  width: number;
  height: number;
}

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

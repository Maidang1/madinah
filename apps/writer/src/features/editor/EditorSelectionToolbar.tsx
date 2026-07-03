import {
  Bold as BoldIcon,
  Code2,
  Italic as ItalicIcon,
  Link as LinkIcon,
  type LucideIcon,
} from "lucide-react";

export interface EditorSelectionToolbarAction {
  id: string;
  label: string;
  commandId: string;
  Icon: LucideIcon;
}

export interface EditorSelectionToolbarPosition {
  x: number;
  y: number;
}

interface SelectionRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Size {
  width: number;
  height: number;
}

interface EditorSelectionToolbarProps {
  actions: EditorSelectionToolbarAction[];
  position: EditorSelectionToolbarPosition;
  onRun: (action: EditorSelectionToolbarAction) => void;
}

export const EDITOR_SELECTION_TOOLBAR_SIZE = {
  width: 176,
  height: 36,
};

export const EDITOR_SELECTION_TOOLBAR_ACTIONS: EditorSelectionToolbarAction[] = [
  {
    id: "bold",
    label: "Bold",
    commandId: "editor.format.bold",
    Icon: BoldIcon,
  },
  {
    id: "italic",
    label: "Italic",
    commandId: "editor.format.italic",
    Icon: ItalicIcon,
  },
  {
    id: "link",
    label: "Link",
    commandId: "editor.format.link",
    Icon: LinkIcon,
  },
  {
    id: "inline-code",
    label: "Inline Code",
    commandId: "editor.format.inlineCode",
    Icon: Code2,
  },
];

export function EditorSelectionToolbar({
  actions,
  position,
  onRun,
}: EditorSelectionToolbarProps) {
  return (
    <div
      className="editor-selection-toolbar"
      style={{ left: position.x, top: position.y }}
      role="toolbar"
      aria-label="Selection formatting"
      onMouseDown={(event) => event.preventDefault()}
    >
      {actions.map(({ Icon, ...action }) => (
        <button
          key={action.id}
          type="button"
          aria-label={action.label}
          title={action.label}
          data-command-id={action.commandId}
          onClick={() => onRun({ ...action, Icon })}
        >
          <Icon size={15} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function getEditorSelectionToolbarPosition(
  selection: SelectionRect,
  toolbar: Size,
  viewport: Size,
): EditorSelectionToolbarPosition {
  const padding = 8;
  const gap = 8;
  const selectionCenter = selection.left + (selection.right - selection.left) / 2;
  const preferredTop = selection.top - toolbar.height - gap;
  const fallbackTop = selection.bottom + gap;
  const rawTop = preferredTop < padding ? fallbackTop : preferredTop;
  const maxX = Math.max(padding, viewport.width - toolbar.width - padding);
  const maxY = Math.max(padding, viewport.height - toolbar.height - padding);

  return {
    x: Math.min(Math.max(selectionCenter - toolbar.width / 2, padding), maxX),
    y: Math.min(Math.max(rawTop, padding), maxY),
  };
}

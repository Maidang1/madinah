import type { DirEntry } from "@/types/fs";
import { FileIcon, FolderIcon } from "./file-tree-icons";
import { useFileTreeLabel } from "./use-file-tree-label";

interface DragGhostProps {
  /** The grabbed entry — rendered identically to its sidebar row. */
  entry: DirEntry;
  /** Total items being dragged; > 1 shows a count badge. */
  count: number;
  /** Row width/indent captured at grab time so the ghost matches the row 1:1. */
  width: number;
  paddingLeft: string;
  /** Folder expansion, so the folder glyph matches the row. */
  isExpanded: boolean;
  fileLabelMode?: string;
}

/**
 * The element that follows the cursor while dragging tree items: a 1:1 copy of
 * the grabbed sidebar row — same selected fill (translucent), size, indent, icon,
 * and label — with a small count badge when several items move together.
 */
export function DragGhost({
  entry,
  count,
  width,
  paddingLeft,
  isExpanded,
  fileLabelMode,
}: DragGhostProps) {
  const label = useFileTreeLabel(entry, fileLabelMode);
  return (
    <div className="relative" style={{ width }}>
      <div
        className="flex h-[32px] items-center gap-1.5 overflow-hidden rounded-lg bg-[var(--surface-selected)] pr-2 text-[13px] leading-[1.15] text-[var(--fg-base)]"
        style={{ paddingLeft }}
      >
        <span className="flex w-5 shrink-0 items-center justify-center opacity-60">
          {entry.is_dir ? <FolderIcon isExpanded={isExpanded} /> : <FileIcon />}
        </span>
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
      </div>
      {count > 1 && (
        <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-semibold leading-none text-white shadow-md ring-2 ring-[var(--bg-base)]">
          {count}
        </span>
      )}
    </div>
  );
}

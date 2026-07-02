import { Eye, PencilLine } from "lucide-react";
import type { WriterViewMode } from "./workbench-state";

interface ViewModeControlProps {
  viewMode: WriterViewMode;
  onViewModeChange: (viewMode: WriterViewMode) => void;
}

export function ViewModeControl({
  viewMode,
  onViewModeChange,
}: ViewModeControlProps) {
  const nextViewMode = viewMode === "write" ? "preview" : "write";
  const label = viewMode === "write" ? "Preview" : "Write";
  const Icon = nextViewMode === "write" ? PencilLine : Eye;

  return (
    <button
      type="button"
      className="writer-view-mode-toggle"
      data-window-no-drag
      data-view-mode-toggle={viewMode}
      aria-label={label}
      title={label}
      onClick={() => onViewModeChange(nextViewMode)}
    >
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}

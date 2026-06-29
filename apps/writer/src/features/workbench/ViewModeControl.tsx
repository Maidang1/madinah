import type { WriterViewMode } from "./workbench-state";

interface ViewModeControlProps {
  viewMode: WriterViewMode;
  onViewModeChange: (viewMode: WriterViewMode) => void;
}

const VIEW_MODE_OPTIONS: Array<{ id: WriterViewMode; label: string }> = [
  { id: "write", label: "Write" },
  { id: "preview", label: "Preview" },
];

export function ViewModeControl({
  viewMode,
  onViewModeChange,
}: ViewModeControlProps) {
  return (
    <div
      className="writer-view-mode-control"
      aria-label="View mode"
      data-tauri-no-drag
    >
      {VIEW_MODE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`writer-view-mode-option${
            viewMode === option.id ? " is-active" : ""
          }`}
          data-tauri-no-drag
          data-view-mode-option={option.id}
          aria-pressed={viewMode === option.id}
          onClick={() => onViewModeChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

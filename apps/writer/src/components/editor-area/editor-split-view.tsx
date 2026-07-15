import { useCallback, useRef, useState, type ReactNode } from "react";
import { useEditorViewModeStore, type EditorViewMode } from "./editor-view-mode-store";
import { EDITOR_SPLIT_RATIO_BOUNDS } from "./editor-view-mode-store";
import { OverlayScrollbar } from "@/components/overlay-scrollbar";
import type { OverlayScrollbarRef } from "@/components/overlay-scrollbar";

interface PaneProps {
  children: ReactNode;
  visible: boolean;
  flexBasis: string;
  ariaLabel: string;
}

function Pane({ children, visible, flexBasis, ariaLabel }: PaneProps) {
  if (!visible) return null;
  return (
    <section
      aria-label={ariaLabel}
      className="relative h-full min-w-0 overflow-hidden"
      style={{ flex: `1 1 ${flexBasis}` }}
    >
      {children}
    </section>
  );
}

interface ViewModeButtonProps {
  mode: EditorViewMode;
  active: boolean;
  onSelect: () => void;
  label: string;
}

function ViewModeButton({ mode, active, onSelect, label }: ViewModeButtonProps) {
  return (
    <button
      type="button"
      data-view-mode={mode}
      aria-pressed={active}
      onClick={onSelect}
      className="rounded-md px-2.5 py-1 text-[12px] font-medium leading-none transition-colors"
      style={{
        background: active ? "var(--item-active-bg)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-muted)",
      }}
    >
      {label}
    </button>
  );
}

interface EditorSplitViewProps {
  writePane: ReactNode;
  previewPane: ReactNode;
  writeScrollRef: React.MutableRefObject<OverlayScrollbarRef | null>;
}

export function EditorSplitView({ writePane, previewPane, writeScrollRef }: EditorSplitViewProps) {
  const mode = useEditorViewModeStore((s) => s.mode);
  const splitRatio = useEditorViewModeStore((s) => s.splitRatio);
  const setMode = useEditorViewModeStore((s) => s.setMode);
  const setSplitRatio = useEditorViewModeStore((s) => s.setSplitRatio);

  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draftRatio, setDraftRatio] = useState(splitRatio);

  // Keep the draft in sync with the store when not dragging.
  if (!draggingRef.current && draftRatio !== splitRatio) {
    setDraftRatio(splitRatio);
  }

  const showWrite = mode === "write" || mode === "split";
  const showPreview = mode === "preview" || mode === "split";
  const isSplit = mode === "split";

  const writeBasis = isSplit ? `${draftRatio * 100}%` : "100%";
  const previewBasis = isSplit ? `${(1 - draftRatio) * 100}%` : "100%";

  // The pointerup handler closes over the draftRatio captured at pointerdown;
  // keep a ref so it reads the latest value.
  const draftRatioRef = useRef(draftRatio);
  draftRatioRef.current = draftRatio;

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      draggingRef.current = true;
      setIsDragging(true);

      const container = event.currentTarget.parentElement;
      if (!container) return;
      const startX = event.clientX;
      const startRatio = draftRatioRef.current;
      const containerWidth = container.getBoundingClientRect().width;

      const previousCursor = document.documentElement.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.documentElement.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMove = (moveEvent: PointerEvent) => {
        if (!containerWidth) return;
        const delta = (moveEvent.clientX - startX) / containerWidth;
        const next = startRatio + delta;
        setDraftRatio(
          Math.max(EDITOR_SPLIT_RATIO_BOUNDS.min, Math.min(EDITOR_SPLIT_RATIO_BOUNDS.max, next)),
        );
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleCancel);
        document.documentElement.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        draggingRef.current = false;
        setIsDragging(false);
      };

      const handleUp = () => {
        setSplitRatio(draftRatioRef.current);
        cleanup();
      };
      const handleCancel = () => {
        setDraftRatio(splitRatio);
        cleanup();
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleCancel);
    },
    [setSplitRatio, splitRatio],
  );

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex h-full min-h-0 flex-1">
        <Pane visible={showWrite} flexBasis={writeBasis} ariaLabel="Editor">
          <OverlayScrollbar ref={writeScrollRef} className="h-full">
            {writePane}
          </OverlayScrollbar>
        </Pane>

        {isSplit && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize editor and preview"
            onPointerDown={handleResizeStart}
            data-dragging={isDragging || undefined}
            className="relative w-px shrink-0 cursor-col-resize bg-[var(--line-subtler)] after:absolute after:inset-y-0 after:-left-1.5 after:w-3 after:content-[''] hover:bg-[var(--border-color)] data-[dragging]:bg-[var(--border-color)]"
          />
        )}

        <Pane visible={showPreview} flexBasis={previewBasis} ariaLabel="Preview">
          <div className="h-full bg-[var(--reader-page)]">{previewPane}</div>
        </Pane>
      </div>

      <div className="pointer-events-auto absolute right-3 top-2 z-30 flex items-center gap-0.5 rounded-lg border border-[var(--line-subtler)] bg-[var(--surface-card)] px-1 py-1 backdrop-blur-md">
        <ViewModeButton
          mode="write"
          active={mode === "write"}
          onSelect={() => setMode("write")}
          label="Write"
        />
        <ViewModeButton
          mode="split"
          active={mode === "split"}
          onSelect={() => setMode("split")}
          label="Split"
        />
        <ViewModeButton
          mode="preview"
          active={mode === "preview"}
          onSelect={() => setMode("preview")}
          label="Preview"
        />
      </div>
    </div>
  );
}

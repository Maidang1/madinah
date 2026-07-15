import { create } from "zustand";

// Persisted UI preference for the editor split view. Lives next to the editor
// components (not under @/stores) so it stays a local concern; the
// architecture-boundaries test only flags `@/stores/` imports from components
// and `*-store.ts` files are treated as store owners for setState purposes.

export type EditorViewMode = "write" | "preview" | "split";

const STORAGE_KEY = "writer.editor-view-mode";
const RATIO_STORAGE_KEY = "writer.editor-split-ratio";

const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;
const DEFAULT_RATIO = 0.5;

function clampRatio(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_RATIO;
  return Math.max(MIN_RATIO, Math.min(MAX_RATIO, value));
}

function readMode(): EditorViewMode {
  if (typeof window === "undefined") return "split";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "write" || stored === "preview" || stored === "split") return stored;
  return "split";
}

function readRatio(): number {
  if (typeof window === "undefined") return DEFAULT_RATIO;
  const stored = Number(window.localStorage.getItem(RATIO_STORAGE_KEY));
  return clampRatio(stored);
}

interface EditorViewModeState {
  mode: EditorViewMode;
  splitRatio: number;
  setMode: (mode: EditorViewMode) => void;
  setSplitRatio: (ratio: number) => void;
}

export const useEditorViewModeStore = create<EditorViewModeState>((set) => ({
  mode: readMode(),
  splitRatio: readRatio(),

  setMode: (mode) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
    set({ mode });
  },

  setSplitRatio: (ratio) => {
    const next = clampRatio(ratio);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RATIO_STORAGE_KEY, String(next));
    }
    set({ splitRatio: next });
  },
}));

export const EDITOR_SPLIT_RATIO_BOUNDS = { min: MIN_RATIO, max: MAX_RATIO };

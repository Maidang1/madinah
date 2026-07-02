import type { WorkbenchStorage } from "./workbench-state";

export type WorkbenchPane = "sidebar" | "inspector";

export interface WorkbenchPaneWidths {
  sidebar: number;
  inspector: number;
}

interface ResizeInput {
  currentClientX: number;
  pane: WorkbenchPane;
  startClientX: number;
  startWidth: number;
}

interface KeyboardResizeInput {
  currentWidth: number;
  key: string;
  pane: WorkbenchPane;
  step?: number;
}

interface PaneBounds {
  min: number;
  max: number;
}

export const DEFAULT_WORKBENCH_PANE_WIDTHS: WorkbenchPaneWidths = {
  sidebar: 280,
  inspector: 260,
};

export const WORKBENCH_PANE_WIDTH_BOUNDS: Record<WorkbenchPane, PaneBounds> = {
  sidebar: { min: 220, max: 420 },
  inspector: { min: 240, max: 520 },
};

export const WORKBENCH_SIDEBAR_WIDTH_STORAGE_KEY =
  "madinah-writer-sidebar-width";
export const WORKBENCH_INSPECTOR_WIDTH_STORAGE_KEY =
  "madinah-writer-inspector-width";

const WORKBENCH_PANE_STORAGE_KEYS: Record<WorkbenchPane, string> = {
  sidebar: WORKBENCH_SIDEBAR_WIDTH_STORAGE_KEY,
  inspector: WORKBENCH_INSPECTOR_WIDTH_STORAGE_KEY,
};

export function getInitialWorkbenchPaneWidths(
  storage?: WorkbenchStorage | null,
): WorkbenchPaneWidths {
  return {
    sidebar: readPaneWidth(storage, "sidebar"),
    inspector: readPaneWidth(storage, "inspector"),
  };
}

export function persistWorkbenchPaneWidth(
  pane: WorkbenchPane,
  width: number,
  storage?: WorkbenchStorage | null,
): void {
  if (!storage) return;

  try {
    storage.setItem(
      WORKBENCH_PANE_STORAGE_KEYS[pane],
      String(clampWorkbenchPaneWidth(pane, width)),
    );
  } catch {
    // localStorage can fail in restricted browser contexts.
  }
}

export function clampWorkbenchPaneWidth(
  pane: WorkbenchPane,
  width: number,
): number {
  const bounds = WORKBENCH_PANE_WIDTH_BOUNDS[pane];
  if (!Number.isFinite(width)) return DEFAULT_WORKBENCH_PANE_WIDTHS[pane];
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(width)));
}

export function getResizedWorkbenchPaneWidth({
  currentClientX,
  pane,
  startClientX,
  startWidth,
}: ResizeInput): number {
  const delta =
    pane === "sidebar"
      ? currentClientX - startClientX
      : startClientX - currentClientX;

  return clampWorkbenchPaneWidth(pane, startWidth + delta);
}

export function getKeyboardWorkbenchPaneWidth({
  currentWidth,
  key,
  pane,
  step = 16,
}: KeyboardResizeInput): number | null {
  if (key === "Home") {
    return WORKBENCH_PANE_WIDTH_BOUNDS[pane].min;
  }
  if (key === "End") {
    return WORKBENCH_PANE_WIDTH_BOUNDS[pane].max;
  }

  const direction =
    key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  if (direction === 0) return null;

  const paneDirection = pane === "sidebar" ? direction : -direction;
  return clampWorkbenchPaneWidth(pane, currentWidth + paneDirection * step);
}

function readPaneWidth(
  storage: WorkbenchStorage | null | undefined,
  pane: WorkbenchPane,
): number {
  const fallback = DEFAULT_WORKBENCH_PANE_WIDTHS[pane];
  if (!storage) return fallback;

  try {
    const value = storage.getItem(WORKBENCH_PANE_STORAGE_KEYS[pane]);
    if (!value) return fallback;
    return clampWorkbenchPaneWidth(pane, Number(value));
  } catch {
    return fallback;
  }
}

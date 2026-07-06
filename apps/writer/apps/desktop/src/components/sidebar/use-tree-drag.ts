import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { DirEntry } from "@/types/fs";
import type { FlatTreeItem } from "./flatten-tree";
import { canMoveInto, resolveDropDir, resolveDropRange } from "./tree-move";
import type { MoveOutcome } from "./use-move-entry";

export interface DropHighlight {
  top: number;
  height: number;
}

export interface DragGhostState {
  /** The grabbed entry — the ghost renders its icon and label like the row. */
  entry: DirEntry;
  count: number;
  /** Row geometry captured at grab time so the ghost matches its size/indent. */
  width: number;
  paddingLeft: string;
  /** Folder expansion, so the ghost's folder glyph matches the row. */
  isExpanded: boolean;
}

// Distance the pointer must travel before a press becomes a drag (so plain
// clicks still open/select).
const DRAG_THRESHOLD_PX = 4;
// How close to the scroll container's edge the pointer must be to auto-scroll,
// and how fast to scroll per animation frame.
const AUTO_SCROLL_EDGE_PX = 28;
const AUTO_SCROLL_SPEED_PX = 8;

interface UseTreeDragArgs {
  rootPath: string;
  flatItems: FlatTreeItem[];
  entryByPath: Map<string, DirEntry>;
  expandedDirs: Set<string>;
  moveEntry: (entry: DirEntry, destDir: string) => Promise<MoveOutcome>;
  toggleDirectory: (path: string) => Promise<void>;
  /** Clears the tree selection after a completed multi-item move. */
  clearSelection: () => void;
}

interface PendingDrag {
  pointerId: number;
  startX: number;
  startY: number;
  /** Pointer offset within the grabbed row at press time, so the ghost lifts
   *  off exactly over the item and keeps the cursor at that same spot. */
  grabOffsetX: number;
  grabOffsetY: number;
  /** Grabbed row geometry, so the ghost matches its width and indent. */
  rowWidth: number;
  rowPaddingLeft: string;
  /** The grabbed row — drives the ghost's icon and name. */
  primary: DirEntry;
  entries: DirEntry[];
  started: boolean;
}

/** Nearest scrollable ancestor, used to auto-scroll the tree during a drag. */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * `data-tree-path` of the row whose vertical band contains `y` (1px gaps attach
 * to the row above), or null when `y` is above the first row. Rows are ordered
 * top-to-bottom, so iteration stops once a row begins below `y`. Used instead of
 * `elementFromPoint` because rows are non-hit-testable during a drag.
 */
function rowPathAtY(container: HTMLElement, y: number): string | null {
  const rows = container.querySelectorAll<HTMLElement>("[data-tree-path]");
  let above: string | null = null;
  for (const row of rows) {
    const rect = row.getBoundingClientRect();
    if (y < rect.top) break;
    if (y <= rect.bottom) return row.getAttribute("data-tree-path");
    above = row.getAttribute("data-tree-path");
  }
  return above;
}

/**
 * Swallow the single `click` that the browser fires after a drag completes, so
 * dragging an item never also opens/toggles it. Self-removes after that click
 * (or on the next tick if no click arrives).
 */
function suppressNextClick() {
  const handler = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    window.removeEventListener("click", handler, true);
  };
  window.addEventListener("click", handler, true);
  setTimeout(() => window.removeEventListener("click", handler, true), 0);
}

/**
 * Pointer-based drag-and-drop for the file tree. We use raw pointer events
 * (not the HTML5 `draggable` API) because the Tauri window has OS drag-drop
 * enabled for the Finder-drop-to-open feature, which suppresses HTML5 DnD
 * events inside the webview.
 */
export function useTreeDrag({
  rootPath,
  flatItems,
  entryByPath,
  expandedDirs,
  moveEntry,
  toggleDirectory,
  clearSelection,
}: UseTreeDragArgs) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  // React state drives rendering. It changes infrequently (drag start/end, and
  // when the highlighted target folder changes) — the ghost *position* is moved
  // imperatively to avoid a re-render on every pointer move.
  const [draggingPaths, setDraggingPaths] = useState<Set<string> | null>(null);
  const [dropTargetDir, setDropTargetDir] = useState<string | null>(null);
  const [dropHighlight, setDropHighlight] = useState<DropHighlight | null>(null);
  const [dragGhost, setDragGhost] = useState<DragGhostState | null>(null);

  // Latest-ref pattern: window listeners are registered once per drag, so they
  // read live props/state through this ref instead of capturing stale values.
  const latest = useRef({
    rootPath,
    entryByPath,
    expandedDirs,
    moveEntry,
    toggleDirectory,
    clearSelection,
  });
  latest.current = {
    rootPath,
    entryByPath,
    expandedDirs,
    moveEntry,
    toggleDirectory,
    clearSelection,
  };

  const pendingRef = useRef<PendingDrag | null>(null);
  const pointerPosRef = useRef({ x: 0, y: 0 });
  const dropTargetRef = useRef<string | null>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const positionGhost = useCallback(() => {
    const ghost = ghostRef.current;
    const pending = pendingRef.current;
    if (!ghost || !pending) return;
    const { x, y } = pointerPosRef.current;
    // Anchor by the grab offset so the ghost starts exactly over the dragged
    // row and the cursor stays at the same spot within it.
    ghost.style.transform = `translate(${x - pending.grabOffsetX}px, ${y - pending.grabOffsetY}px)`;
    ghost.style.opacity = "1";
  }, []);

  // Resolve the folder under the pointer and, if at least one dragged item can
  // legally move there, highlight it as the drop target.
  const updateDropTarget = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    const { x, y } = pointerPosRef.current;
    const { rootPath: root, entryByPath: entries } = latest.current;
    const container = containerRef.current;

    // Hit-test by geometry rather than `elementFromPoint`: rows are made
    // non-hit-testable during a drag (to avoid stuck `:hover`), so they wouldn't
    // be returned by `elementFromPoint` anyway.
    let dest: string | null = null;
    if (container) {
      const rect = container.getBoundingClientRect();
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      if (inside) {
        const path = rowPathAtY(container, y);
        const target = path ? (entries.get(path) ?? null) : null;
        dest = resolveDropDir(target, root);
      }
    }

    const valid =
      dest !== null && pending.entries.some((en) => canMoveInto(en.path, en.is_dir, dest!));
    const next = valid ? dest : null;
    if (dropTargetRef.current !== next) {
      dropTargetRef.current = next;
      setDropTargetDir(next);
    }
  }, []);

  // Animation loop that runs for the duration of a drag: auto-scrolls near the
  // edges and keeps the target/ghost in sync while the pointer is held still.
  const tick = useCallback(() => {
    const scroller = scrollParentRef.current;
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      const y = pointerPosRef.current.y;
      if (y < rect.top + AUTO_SCROLL_EDGE_PX) {
        scroller.scrollTop -= AUTO_SCROLL_SPEED_PX;
      } else if (y > rect.bottom - AUTO_SCROLL_EDGE_PX) {
        scroller.scrollTop += AUTO_SCROLL_SPEED_PX;
      }
    }
    positionGhost();
    updateDropTarget();
    rafRef.current = requestAnimationFrame(tick);
  }, [positionGhost, updateDropTarget]);

  const endDrag = useCallback(() => {
    document.body.classList.remove("tree-dragging");
    abortRef.current?.abort();
    abortRef.current = null;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    scrollParentRef.current = null;
    pendingRef.current = null;
    dropTargetRef.current = null;
    setDraggingPaths(null);
    setDropTargetDir(null);
    setDragGhost(null);
  }, []);

  const performDrop = useCallback(async (entries: DirEntry[], dest: string) => {
    const {
      moveEntry: move,
      toggleDirectory: toggle,
      expandedDirs: expanded,
      rootPath: root,
      clearSelection: clear,
    } = latest.current;

    const outcomes = await Promise.all(entries.map((entry) => move(entry, dest)));
    clear();

    // Reveal the destination so the moved items are visible.
    if (dest !== root && !expanded.has(dest)) {
      void toggle(dest);
    }

    const failures: string[] = [];
    for (const outcome of outcomes) {
      if (outcome.status === "exists") {
        failures.push(`• "${outcome.entry.name}" — an item with that name already exists`);
      } else if (outcome.status === "error") {
        const message =
          outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
        failures.push(`• "${outcome.entry.name}" — ${message}`);
      }
    }
    if (failures.length > 0) {
      window.alert(
        `Couldn't move ${failures.length} item${failures.length > 1 ? "s" : ""}:\n${failures.join("\n")}`,
      );
    }
  }, []);

  const handleMove = useCallback(
    (event: PointerEvent) => {
      const pending = pendingRef.current;
      if (!pending || event.pointerId !== pending.pointerId) return;
      pointerPosRef.current = { x: event.clientX, y: event.clientY };

      if (!pending.started) {
        const dx = event.clientX - pending.startX;
        const dy = event.clientY - pending.startY;
        if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
        pending.started = true;
        setDraggingPaths(new Set(pending.entries.map((entry) => entry.path)));
        setDragGhost({
          entry: pending.primary,
          count: pending.entries.length,
          width: pending.rowWidth,
          paddingLeft: pending.rowPaddingLeft,
          isExpanded:
            pending.primary.is_dir && latest.current.expandedDirs.has(pending.primary.path),
        });
        scrollParentRef.current = findScrollParent(containerRef.current);
        document.body.classList.add("tree-dragging");
        rafRef.current = requestAnimationFrame(tick);
      }

      positionGhost();
      updateDropTarget();
    },
    [positionGhost, tick, updateDropTarget],
  );

  const handleEnd = useCallback(
    (event: PointerEvent) => {
      const pending = pendingRef.current;
      if (!pending || event.pointerId !== pending.pointerId) return;
      const { started, entries } = pending;
      const dest = dropTargetRef.current;
      endDrag();
      if (!started) return; // A plain click — let it open/select normally.
      suppressNextClick();
      if (dest) void performDrop(entries, dest);
    },
    [endDrag, performDrop],
  );

  // Arm a drag for an already-decided set of rows. The caller (the tree's
  // pointer-down handler) owns selection and passes what should move, so drag
  // and selection are settled together at press time.
  const beginDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, entries: DirEntry[], primary: DirEntry) => {
      const rowRect = event.currentTarget.getBoundingClientRect();
      const rowPaddingLeft = getComputedStyle(event.currentTarget).paddingLeft;

      pendingRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        grabOffsetX: event.clientX - rowRect.left,
        grabOffsetY: event.clientY - rowRect.top,
        rowWidth: rowRect.width,
        rowPaddingLeft,
        primary,
        entries,
        started: false,
      };
      pointerPosRef.current = { x: event.clientX, y: event.clientY };

      const controller = new AbortController();
      abortRef.current = controller;
      window.addEventListener("pointermove", handleMove, { signal: controller.signal });
      window.addEventListener("pointerup", handleEnd, { signal: controller.signal });
      window.addEventListener("pointercancel", handleEnd, { signal: controller.signal });
    },
    [handleEnd, handleMove],
  );

  // Tear down a drag in progress if the tree unmounts mid-gesture.
  useEffect(() => endDrag, [endDrag]);

  // Measure the destination "container" — the drop-target folder row plus its
  // visible descendants — into a single rectangle so it can be highlighted as
  // one block rather than per-row. Recomputed when the target or tree changes.
  // The setDropHighlight calls are mutually-exclusive early-return branches writing one state atom; at most one runs per pass, so there is no multi-render cascade.
  // eslint-disable-next-line react-doctor/no-cascading-set-state
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || dropTargetDir === null) {
      setDropHighlight(null);
      return;
    }
    const range = resolveDropRange(
      flatItems.map((item) => ({ path: item.entry.path, depth: item.depth })),
      dropTargetDir,
      rootPath,
    );
    const startEl =
      range &&
      container.querySelector<HTMLElement>(`[data-tree-path="${CSS.escape(range.startPath)}"]`);
    const endEl =
      range &&
      container.querySelector<HTMLElement>(`[data-tree-path="${CSS.escape(range.endPath)}"]`);
    if (!startEl || !endEl) {
      setDropHighlight(null);
      return;
    }
    const top = startEl.offsetTop;
    setDropHighlight({ top, height: endEl.offsetTop + endEl.offsetHeight - top });
  }, [dropTargetDir, flatItems, rootPath]);

  return { containerRef, ghostRef, draggingPaths, dropHighlight, dragGhost, beginDrag };
}

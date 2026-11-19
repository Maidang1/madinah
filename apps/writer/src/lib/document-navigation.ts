// Open a Workspace Document and optionally scroll to a heading slug.
// Uses path-scoped editor registration + the pending-anchor bridge so
// navigation works with navigate-in-place multi-tab sessions.

import { getActiveFilePath, openFile } from "@/hooks/editor-api";
import { consumePendingAnchor, setPendingAnchor } from "./pending-anchor";

/** Scroll the registered editor for a path to the given heading slug. */
export type PathHeadingScroller = (anchor: string) => boolean;

export type OpenCitationResult =
  | { status: "opened" }
  | { status: "scrolled" }
  | { status: "pending" }
  | { status: "missing-anchor"; path: string; anchor: string };

const scrollersByPath = new Map<string, PathHeadingScroller>();

/**
 * Register (or clear) a heading scroller for one absolute Document path.
 * Keep-alive TipTap panes each own their path; unmount deletes only that entry.
 * Same-active citation clicks use this Map; cross-document opens rely on
 * pending-anchor + the active tab's pathChanged consumer instead.
 */
export function registerOpenEditorHeadingScroller(
  path: string,
  scroller: PathHeadingScroller | null,
): void {
  if (scroller === null) {
    scrollersByPath.delete(path);
    return;
  }
  scrollersByPath.set(path, scroller);
}

export function getOpenEditorHeadingScroller(path: string): PathHeadingScroller | undefined {
  return scrollersByPath.get(path);
}

/** Test seam: drop every registered scroller. */
export function clearOpenEditorHeadingScrollersForTests(): void {
  scrollersByPath.clear();
}

/**
 * Open a citation target and navigate to an optional heading.
 *
 * - Same active Document: scroll via the path-scoped scroller; never call openFile
 *   (it is a no-op when the path is already active and would leave pending anchors stuck).
 * - Other Documents: stage pending-anchor and openFile only. Writer navigates the
 *   active tab in place, so the active TipTap pathChanged effect must consume the
 *   pending slug. Do not scroll via a keep-alive Map entry for the target path —
 *   that would scroll an invisible pane and steal the pending anchor from the
 *   visible active editor.
 *
 * Callers should surface `missing-anchor` results (e.g. anchor warning banner).
 */
export async function openDocumentAtCitation(
  absolutePath: string,
  anchor?: string,
): Promise<OpenCitationResult> {
  if (!anchor) {
    await openFile(absolutePath);
    return { status: "opened" };
  }

  const alreadyActive = getActiveFilePath() === absolutePath;
  if (alreadyActive) {
    return scrollActiveDocumentToAnchor(absolutePath, anchor);
  }

  setPendingAnchor(absolutePath, anchor);
  await openFile(absolutePath);
  // Leave pending for the active tab's TipTap pathChanged consumer.
  return { status: "pending" };
}

function scrollActiveDocumentToAnchor(absolutePath: string, anchor: string): OpenCitationResult {
  // Drop any stale pending so a later open cannot double-scroll.
  consumePendingAnchor(absolutePath);
  const scroller = scrollersByPath.get(absolutePath);
  if (scroller?.(anchor)) {
    return { status: "scrolled" };
  }
  return { status: "missing-anchor", path: absolutePath, anchor };
}

// Open a Workspace Document and optionally scroll to a heading slug.
// Uses the pending-anchor bridge so navigation survives async file load.

import { getActiveFilePath, openFile } from "@/hooks/editor-api";
import { setPendingAnchor } from "./pending-anchor";

export type ScrollToHeadingFn = (path: string, anchor: string) => boolean;

let scrollToHeadingInOpenEditor: ScrollToHeadingFn | null = null;

/** TipTap registers this so same-document citation clicks can scroll immediately. */
export function registerOpenEditorHeadingScroller(scroller: ScrollToHeadingFn | null): void {
  scrollToHeadingInOpenEditor = scroller;
}

export async function openDocumentAtCitation(absolutePath: string, anchor?: string): Promise<void> {
  if (anchor && getActiveFilePath() === absolutePath && scrollToHeadingInOpenEditor) {
    const scrolled = scrollToHeadingInOpenEditor(absolutePath, anchor);
    if (scrolled) return;
  }
  if (anchor) {
    setPendingAnchor(absolutePath, anchor);
  }
  await openFile(absolutePath);
}

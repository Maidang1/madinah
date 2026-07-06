import { useEditorStore } from "@/stores/editor-store";
import * as tauri from "@/lib/tauri";

/** Record a file into the global recents list (app-wide, cross-workspace).
 *  Errors are logged, not surfaced — recents are best-effort metadata. */
export function recordRecentFile(path: string) {
  tauri.recordRecentFile(path).catch((error) => {
    console.error("Failed to record recent file", error);
  });
}

// Single write path for the global recents list: every file that becomes
// active in this window — workspace tab, compact open, session restore's
// focused tab — is recorded once. Background tab loads never become active,
// so they don't flood the list.
if (typeof window !== "undefined") {
  useEditorStore.subscribe((state, prev) => {
    if (state.activeFilePath === prev.activeFilePath) return;
    if (!state.activeFilePath) return;
    recordRecentFile(state.activeFilePath);
  });
}

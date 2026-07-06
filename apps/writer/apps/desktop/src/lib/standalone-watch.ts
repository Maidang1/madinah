import { useEditorStore } from "@/stores/editor-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import * as tauri from "@/lib/tauri";

// Single write path for the standalone single-file watcher. Whenever the
// active file changes in a standalone compact window (no workspace) — via the
// picker, an internal link click, or back/forward navigation — re-point the
// Rust parent-dir watcher at the now-active file so external edits keep
// reloading and the standalone-window dedupe key stays current. Workspace
// windows have their own recursive watcher and are skipped.
//
// Registered unconditionally (no `typeof window` guard): this is a
// browser-only Tauri app with no SSR, so the subscription is inert until an
// `activeFilePath` change actually occurs, and registering at module load
// keeps it exercisable in unit tests.
useEditorStore.subscribe((state, prev) => {
  if (state.activeFilePath === prev.activeFilePath) return;
  if (!state.activeFilePath) return;

  const { root, chromeMode } = useWorkspaceStore.getState();
  if (root !== null || chromeMode !== "compact-file") return;

  tauri.watchStandaloneFile(state.activeFilePath).catch((error) => {
    console.error("Failed to watch standalone file", error);
  });
});

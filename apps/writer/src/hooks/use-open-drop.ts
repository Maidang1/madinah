import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useEditorStore } from "@/stores/editor-store";
import { useSettingsStore } from "@/stores/settings-store";
import { mark } from "@/lib/startup-metrics";
import type { PendingOpenPayload } from "@/lib/tauri";
import type { FileContent } from "@/types/fs";
import * as tauri from "@/lib/tauri";

/** Open a file in this window's standalone compact chrome. The shared path
 *  for startup, drag-drop, the compact picker, and the command palette. The
 *  single-file watcher is re-pointed by the `standalone-watch` subscription
 *  whenever the active file changes (covers links and back/forward too). */
export async function openStandaloneFile(path: string, prefetched: FileContent | null = null) {
  useWorkspaceStore.getState().setChromeMode("compact-file");
  await useEditorStore.getState().openCompactFile(path, prefetched);
}

export async function handleOpenPayload(payload: PendingOpenPayload) {
  const workspaceState = useWorkspaceStore.getState();
  const current = workspaceState.root;

  // File-only payload: standalone compact open. A window hosting a
  // workspace never switches chrome — the file gets its own window.
  if (!payload.workspace) {
    if (!payload.file) return;
    if (current) {
      await tauri.openFileInStandaloneWindow(payload.file);
      return;
    }
    await openStandaloneFile(payload.file);
    return;
  }

  // Folder payload onto a standalone compact window: keep this window
  // pure and open the workspace in a fresh window.
  if (!current && workspaceState.chromeMode === "compact-file") {
    await tauri.openWorkspaceInNewWindow(payload.workspace, payload.file);
    return;
  }

  // Different workspace: open in a new in-process window so the current
  // window is preserved. The new window pre-queues the pending-open payload
  // and hydrates onto it during its normal startup flow.
  if (current && payload.workspace !== current) {
    await tauri.openWorkspaceInNewWindow(payload.workspace, payload.file);
    return;
  }

  if (payload.workspace !== current) {
    await useWorkspaceStore.getState().openWorkspace(payload.workspace);
  }

  if (payload.file) {
    await useEditorStore.getState().openFile(payload.file);
  }
}

let openTask: Promise<void> = Promise.resolve();

function queueOpenTask(task: () => Promise<void>) {
  const nextTask = openTask.then(task);
  openTask = nextTask.catch(() => {});
  return nextTask;
}

function queueOpenPayload(payload: PendingOpenPayload) {
  return queueOpenTask(() => handleOpenPayload(payload));
}

export function createPendingOpenDrainer(
  takePendingOpen: () => Promise<PendingOpenPayload | null>,
  consumePendingOpen: (payload: PendingOpenPayload) => Promise<void>,
) {
  let drainRequested = false;
  let drainPromise: Promise<void> | null = null;

  return async function drainPendingOpens() {
    drainRequested = true;
    if (drainPromise) {
      await drainPromise;
      return;
    }

    drainPromise = (async () => {
      while (drainRequested) {
        drainRequested = false;
        while (true) {
          const payload = await takePendingOpen();
          if (!payload) break;
          try {
            await consumePendingOpen(payload);
          } catch (error) {
            console.error("Failed to process pending open", error);
          }
        }
      }
    })();

    try {
      await drainPromise;
    } finally {
      drainPromise = null;
    }
  };
}

const drainPendingOpens = createPendingOpenDrainer(tauri.takePendingOpen, queueOpenPayload);

// Guard against React 18 StrictMode double-mount
let startupInitiated = false;
let startupReady: Promise<void> = Promise.resolve();

async function resolveStartup() {
  mark("resolve-start");

  try {
    mark("ipc:get_startup_state:start");
    const startup = await tauri.getStartupState();
    mark("ipc:get_startup_state:end");

    useSettingsStore.getState().hydrateFromBackend({
      settings: startup.settings,
    });

    useWorkspaceStore.getState().hydrateRecentWorkspaces(startup.recent_workspaces);

    if (startup.standalone_file) {
      await openStandaloneFile(startup.standalone_file.path, startup.standalone_file);
    } else if (startup.restore_bundle) {
      await useWorkspaceStore.getState().restoreFromBundle(startup.restore_bundle);
    }
  } catch (error) {
    console.error("Failed to resolve startup state", error);
  }

  useWorkspaceStore.getState().setStartupResolved();
  mark("resolved");

  await tauri.showMainWindow();
}

export function useOpenDrop() {
  useEffect(() => {
    if (!startupInitiated) {
      startupInitiated = true;
      const startupTask = resolveStartup();
      startupReady = startupTask.catch(() => {});
    }

    // Listen for runtime open events (drag-drop, single-instance, macOS dock)
    const unlisten = listen("open:from-drop", () => {
      void startupReady.then(() => drainPendingOpens());
    });

    void unlisten.then(() => startupReady.then(() => drainPendingOpens()));

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);
}

import { useCallback, useEffect, useState } from "react";
import * as tauri from "@/lib/tauri";
import type { RecentFile } from "@/lib/tauri";

// This hook's `files` state is populated from async Tauri IPC and optimistically
// mutated by remove() — it is not derivable during render, so no-derived-state
// does not apply here.
/* eslint-disable react-doctor/no-derived-state */

interface GlobalRecentFiles {
  files: RecentFile[];
  /** Remove one entry from the global recents (optimistic + persisted). */
  remove: (path: string) => void;
  /** Re-fetch the list from the backend. */
  refresh: () => void;
}

/** Global recently-opened files (cross-workspace, persisted in app data).
 *  Fetched whenever `enabled` becomes true (and on mount when it already
 *  is), so always-mounted consumers like the command palette refresh per
 *  open while per-open-mounted consumers fetch once. Entries are already
 *  pruned of deleted files server-side. */
export function useGlobalRecentFiles(limit = 30, enabled = true): GlobalRecentFiles {
  const [files, setFiles] = useState<RecentFile[]>([]);

  const refresh = useCallback(() => {
    let cancelled = false;
    void tauri
      .getRecentFilesGlobal(limit)
      .then((entries) => {
        if (!cancelled) setFiles(entries);
      })
      .catch((error: unknown) => {
        console.error("Failed to read global recent files", error);
      });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  useEffect(() => {
    if (!enabled) return;
    return refresh();
  }, [enabled, refresh]);

  const remove = useCallback((path: string) => {
    setFiles((prev) => prev.filter((file) => file.path !== path));
    tauri.removeRecentFile(path).catch((error: unknown) => {
      console.error("Failed to remove recent file", error);
    });
  }, []);

  return { files, remove, refresh };
}

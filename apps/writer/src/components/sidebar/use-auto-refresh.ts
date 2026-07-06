import { useEffect } from "react";
import { useRefreshDirectory } from "@/hooks/use-file-tree";

/**
 * Automatically refreshes a directory when its cache entry is missing.
 * Acts as a self-healing mechanism — if the cache is evicted by a watcher
 * event or race condition, the tree recovers instead of going blank.
 */
export function useAutoRefresh(path: string, isEmpty: boolean) {
  const refreshDirectory = useRefreshDirectory();

  useEffect(() => {
    if (!isEmpty) return;
    void refreshDirectory(path);
  }, [path, isEmpty, refreshDirectory]);
}

import { useEffect, useRef, useState } from "react";
import * as tauri from "@/lib/tauri";
import type { SearchResult } from "@/types/fs";

export function useFuzzySearch(query: string, limit = 20) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasQuery = query.trim() !== "";

  useEffect(() => {
    if (!hasQuery) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void tauri.fuzzySearch(query, limit).then(setResults);
    }, 50);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, limit, hasQuery]);

  // Empty queries have no results — derive this during render instead of
  // clearing state in the effect, so callers never see a stale frame.
  return hasQuery ? results : [];
}

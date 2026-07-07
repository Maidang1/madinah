import { invoke } from "@tauri-apps/api/core";
import type { IndexStats, SearchResult } from "@/types/fs";

export function indexWorkspace(): Promise<IndexStats> {
  return invoke("index_workspace");
}

export function fuzzySearch(query: string, limit?: number): Promise<SearchResult[]> {
  return invoke("fuzzy_search", { query, limit });
}

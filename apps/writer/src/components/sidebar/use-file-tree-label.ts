import { useResolvedDocumentTitle } from "@/hooks/use-tabs";
import { getFileStem } from "@/lib/paths";
import type { DirEntry } from "@/types/fs";

/**
 * The label shown for a file-tree entry, honoring `appearance.sidebar-file-label`:
 * folders show their name; files show the filename stem in `"filename"` mode,
 * otherwise the resolved document title with a stem fallback. Shared by the tree
 * rows and the drag ghost so they always display the same text.
 */
export function useFileTreeLabel(entry: DirEntry, fileLabelMode?: string): string {
  const editorTitle = useResolvedDocumentTitle(entry.is_dir ? null : entry.path);
  if (entry.is_dir) return entry.name;
  if (fileLabelMode === "filename") return getFileStem(entry.name);
  return editorTitle || entry.title || getFileStem(entry.name);
}

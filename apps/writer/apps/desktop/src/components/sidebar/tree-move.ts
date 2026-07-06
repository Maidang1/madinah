import { getParentDir } from "@/lib/paths";
import type { DirEntry } from "@/types/fs";

/**
 * Resolve the destination directory for a drop, given the row under the
 * pointer (or `null` when the pointer is over empty tree space).
 *
 * - Folder target → into that folder.
 * - File target   → into the file's parent folder.
 * - No target     → the workspace root.
 */
export function resolveDropDir(target: DirEntry | null, rootPath: string): string {
  if (!target) return rootPath;
  return target.is_dir ? target.path : getParentDir(target.path);
}

/**
 * Whether `sourcePath` can be moved into `destDir`. Rejects no-ops (the item
 * already lives directly in `destDir`) and illegal directory moves (a folder
 * into itself or one of its own descendants).
 */
export function canMoveInto(sourcePath: string, sourceIsDir: boolean, destDir: string): boolean {
  // Already lives directly in the destination → nothing to move.
  if (getParentDir(sourcePath) === destDir) return false;
  if (sourceIsDir) {
    // Can't move a folder into itself or any of its descendants.
    if (destDir === sourcePath) return false;
    if (destDir.startsWith(`${sourcePath}/`)) return false;
  }
  return true;
}

/** Destination path for moving `entry` into `destDir`, preserving its name. */
export function computeMovePath(entry: DirEntry, destDir: string): string {
  return `${destDir}/${entry.name}`;
}

/**
 * The contiguous run of visible rows that make up the drop destination's
 * "container" — the destination folder row plus all of its currently-visible
 * descendants (rows deeper than it, until the next sibling). Returns the first
 * and last row paths of that run, or `null` if the destination isn't visible.
 * For the workspace root the whole tree is the container.
 */
export function resolveDropRange(
  rows: ReadonlyArray<{ path: string; depth: number }>,
  destDir: string,
  rootPath: string,
): { startPath: string; endPath: string } | null {
  if (rows.length === 0) return null;
  if (destDir === rootPath) {
    return { startPath: rows[0].path, endPath: rows[rows.length - 1].path };
  }
  const startIndex = rows.findIndex((row) => row.path === destDir);
  if (startIndex === -1) return null;
  const baseDepth = rows[startIndex].depth;
  let endIndex = startIndex;
  for (let i = startIndex + 1; i < rows.length; i += 1) {
    if (rows[i].depth > baseDepth) endIndex = i;
    else break;
  }
  return { startPath: rows[startIndex].path, endPath: rows[endIndex].path };
}

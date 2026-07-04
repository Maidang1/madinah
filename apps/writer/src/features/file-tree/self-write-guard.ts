export const SELF_WRITE_FILE_TREE_IGNORE_MS = 2_500;

export type SelfWrittenFileMap = Map<string, number>;

export function markSelfWrittenFilePath(
  writes: SelfWrittenFileMap,
  filePath: string,
  now = Date.now(),
): void {
  writes.set(filePath, now);
}

export function shouldIgnoreSelfWrittenFileTreeChange(
  writes: SelfWrittenFileMap,
  changedPath: string | undefined,
  now = Date.now(),
  ignoreMs = SELF_WRITE_FILE_TREE_IGNORE_MS,
): boolean {
  if (!changedPath) return false;

  const writtenAt = writes.get(changedPath);
  if (writtenAt === undefined) return false;

  if (now - writtenAt <= ignoreMs) {
    return true;
  }

  writes.delete(changedPath);
  return false;
}

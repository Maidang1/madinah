import * as tauri from "@/lib/tauri";
import { getOpenFile } from "@/hooks/editor-api";
import { serializeDocument } from "@/lib/frontmatter";
import { getFileStem } from "@/lib/paths";

const COPY_SUFFIX = " copy";

function getParentPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) return "/";
  return normalized.slice(0, lastSlash);
}

function getExtension(path: string): string {
  const name = path.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "";
  return name.slice(dot);
}

/**
 * Generate the next available `note copy.md`, `note copy 2.md`, ... sibling.
 * Stops at 1000 to avoid runaway loops if the parent directory is corrupted.
 */
async function resolveDuplicatePath(sourcePath: string): Promise<string> {
  const parent = getParentPath(sourcePath);
  const ext = getExtension(sourcePath);
  const baseStem = getFileStem(sourcePath);

  // First attempt: `<stem> copy<ext>`
  const firstCandidate = `${parent}/${baseStem}${COPY_SUFFIX}${ext}`;
  if (!(await tauri.fileExists(firstCandidate))) {
    return firstCandidate;
  }

  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${parent}/${baseStem}${COPY_SUFFIX} ${n}${ext}`;
    if (!(await tauri.fileExists(candidate))) {
      return candidate;
    }
  }

  throw new Error(`Could not find an available duplicate name for ${sourcePath}`);
}

/**
 * Read the source file, resolve a unique sibling path, and write a copy.
 *
 * If the source file is currently open and dirty, the in-memory editor state
 * (frontmatter + body + title) is used so the duplicate matches what the user
 * actually sees, rather than the older disk content. Clean / unopened files
 * are duplicated straight from disk.
 *
 * Returns the new file path on success.
 */
export async function duplicateFile(sourcePath: string): Promise<string> {
  const targetPath = await resolveDuplicatePath(sourcePath);

  const openFile = getOpenFile(sourcePath);
  let content: string;

  if (openFile && openFile.isDirty && !openFile.isLoading) {
    content = serializeDocument(openFile.frontmatter, openFile.content);
  } else {
    const raw = await tauri.readFile(sourcePath);
    content = raw.content;
  }

  await tauri.createFile(targetPath);
  await tauri.writeFile(targetPath, content);
  return targetPath;
}

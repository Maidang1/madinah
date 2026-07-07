import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { DirEntry, FileContent, WriteResult } from "@/types/fs";

export function readDirectory(path: string): Promise<DirEntry[]> {
  return invoke("read_directory", { path });
}

export function readRecentFiles(limit: number, offset: number): Promise<DirEntry[]> {
  return invoke("read_recent_files", { limit, offset });
}

export function readFileEntries(paths: string[]): Promise<DirEntry[]> {
  return invoke("read_file_entries", { paths });
}

export function readFile(path: string): Promise<FileContent> {
  return invoke("read_file", { path });
}

export function writeFile(path: string, content: string): Promise<WriteResult> {
  return invoke("write_file", { path, content });
}

export function createFile(path: string): Promise<FileContent> {
  return invoke("create_file", { path });
}

export function createDirectory(path: string): Promise<DirEntry> {
  return invoke("create_directory", { path });
}

export function renameEntry(oldPath: string, newPath: string): Promise<void> {
  return invoke("rename_entry", { oldPath, newPath });
}

export function deleteEntry(path: string): Promise<void> {
  return invoke("delete_entry", { path });
}

export function fileExists(path: string): Promise<boolean> {
  return invoke("file_exists", { path });
}

export function revealInFileManager(path: string): Promise<void> {
  return invoke("reveal_in_file_manager", { path });
}

export async function pickFile(): Promise<string | null> {
  return openDialog({
    directory: false,
    multiple: false,
    title: "Open File",
    filters: [{ name: "Markdown", extensions: ["md", "mdx", "markdown", "txt"] }],
  });
}

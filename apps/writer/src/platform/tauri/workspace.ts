import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type { DirEntry, FileContent, WorkspaceInfo } from "@/types/fs";

export interface SessionData {
  tabs?: SessionTabData[];
  active_index?: number | null;
}

export interface SerializedLocationData {
  kind: string;
  [key: string]: unknown;
}

export interface SessionTabData {
  location: SerializedLocationData;
  back: SerializedLocationData[];
  forward: SerializedLocationData[];
}

export interface RestoreWorkspaceResponse {
  workspace: WorkspaceInfo;
  entries: DirEntry[];
  recent_workspaces: string[];
  session: SessionData | null;
  active_file: FileContent | null;
  open_file: string | null;
}

export interface PendingOpenPayload {
  workspace: string | null;
  file: string | null;
}

export interface RecentFile {
  path: string;
  name: string;
  title: string | null;
  opened_at: number;
}

export function openWorkspace(path: string): Promise<WorkspaceInfo> {
  return invoke("open_workspace", { path });
}

export function openWorkspaceInNewWindow(path: string, file?: string | null): Promise<void> {
  return invoke("open_workspace_in_new_window", { path, file: file ?? null });
}

export function restoreWorkspace(path: string): Promise<RestoreWorkspaceResponse> {
  return invoke("restore_workspace", { path });
}

export async function pickWorkspace(): Promise<string | null> {
  return openDialog({
    directory: true,
    multiple: false,
    title: "Open Folder",
  });
}

export function getRecentWorkspaces(): Promise<string[]> {
  return invoke("get_recent_workspaces");
}

export function removeRecentWorkspace(path: string): Promise<void> {
  return invoke("remove_recent_workspace", { path });
}

export function openFileInStandaloneWindow(path: string): Promise<void> {
  return invoke("open_file_in_standalone_window", { path });
}

export function watchStandaloneFile(path: string): Promise<void> {
  return invoke("watch_standalone_file", { path });
}

export function recordRecentFile(path: string): Promise<void> {
  return invoke("record_recent_file", { path });
}

export function removeRecentFile(path: string): Promise<void> {
  return invoke("remove_recent_file", { path });
}

export function getRecentFilesGlobal(limit?: number): Promise<RecentFile[]> {
  return invoke("get_recent_files_global", { limit: limit ?? null });
}

export function saveSession(
  workspaceRoot: string,
  tabs: SessionTabData[],
  activeIndex: number | null,
): Promise<void> {
  return invoke("save_session", { workspaceRoot, tabs, activeIndex });
}

export function loadSession(workspaceRoot: string): Promise<SessionData | null> {
  return invoke("load_session", { workspaceRoot });
}

export function takePendingOpen(): Promise<PendingOpenPayload | null> {
  return invoke("take_pending_open");
}

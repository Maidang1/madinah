import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import type {
  DirEntry,
  FileContent,
  IndexStats,
  SearchResult,
  WriteResult,
  WorkspaceInfo,
} from "@/types/fs";

// Filesystem commands
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

// Workspace commands
export function openWorkspace(path: string): Promise<WorkspaceInfo> {
  return invoke("open_workspace", { path });
}

/** Open a new in-process window for the given workspace. Each window owns
 *  its own per-window `WorkspaceState` on the Rust side (watcher, file
 *  index, settings layer) so two windows hosting different workspaces don't
 *  share file events or search results. Pass `file` to have the new window
 *  focus a specific Markdown-family file inside the workspace. If another window
 *  already hosts `path`, that window is focused instead. */
export function openWorkspaceInNewWindow(path: string, file?: string | null): Promise<void> {
  return invoke("open_workspace_in_new_window", { path, file: file ?? null });
}

/** Bundled startup-restore IPC. Returns workspace info, root directory
 *  entries, the recents list, the persisted session, and (when available)
 *  the active tab's file content in a single round trip. */
export interface RestoreWorkspaceResponse {
  workspace: WorkspaceInfo;
  entries: DirEntry[];
  recent_workspaces: string[];
  session: SessionData | null;
  active_file: FileContent | null;
  open_file: string | null;
}

export function restoreWorkspace(path: string): Promise<RestoreWorkspaceResponse> {
  return invoke("restore_workspace", { path });
}

export async function pickWorkspace(): Promise<string | null> {
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title: "Open Folder",
  });
  return selected;
}

export async function pickFile(): Promise<string | null> {
  const selected = await openDialog({
    directory: false,
    multiple: false,
    title: "Open File",
    filters: [{ name: "Markdown", extensions: ["md", "mdx", "markdown", "txt"] }],
  });
  return selected;
}

export function getRecentWorkspaces(): Promise<string[]> {
  return invoke("get_recent_workspaces");
}

export function removeRecentWorkspace(path: string): Promise<void> {
  return invoke("remove_recent_workspace", { path });
}

/** Open a Markdown-family file in a standalone compact window (no workspace). If a
 *  standalone window already hosts the file, it is focused instead. */
export function openFileInStandaloneWindow(path: string): Promise<void> {
  return invoke("open_file_in_standalone_window", { path });
}

/** Point this window's watcher at a single standalone file (parent-dir,
 *  non-recursive). Call whenever the standalone compact window switches
 *  files. */
export function watchStandaloneFile(path: string): Promise<void> {
  return invoke("watch_standalone_file", { path });
}

// Global recents (persisted across workspaces in the app data dir)
/** A recently-opened file with its last-opened time. `opened_at` is unix
 *  seconds; `0` marks a legacy entry whose open time is unknown. */
export interface RecentFile {
  path: string;
  name: string;
  title: string | null;
  opened_at: number;
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

// Session commands
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

// Search commands
export function indexWorkspace(): Promise<IndexStats> {
  return invoke("index_workspace");
}

export function fuzzySearch(query: string, limit?: number): Promise<SearchResult[]> {
  return invoke("fuzzy_search", { query, limit });
}

// Settings commands
export function getSettings(): Promise<Record<string, unknown>> {
  return invoke("get_settings");
}

export function getSetting(key: string): Promise<unknown> {
  return invoke("get_setting", { key });
}

export function setSetting(
  key: string,
  value: unknown,
  scope: "global" | "workspace" = "global",
): Promise<void> {
  return invoke("set_setting", { key, value, scope });
}

export function resetSetting(key: string, scope: "global" | "workspace" = "global"): Promise<void> {
  return invoke("reset_setting", { key, scope });
}

// Pending open queue (drag-drop / CLI arg / dock open). A folder open
// carries `workspace`; a markdown-file open carries only `file` and opens
// standalone (compact window, no workspace).
export interface PendingOpenPayload {
  workspace: string | null;
  file: string | null;
}

export function takePendingOpen(): Promise<PendingOpenPayload | null> {
  return invoke("take_pending_open");
}

// Startup state (single IPC call for all initialization data). The settings
// schema is NOT included — it's a build-time constant that the frontend
// imports statically from `@/lib/settings-schema` rather than fetching over
// IPC. Rust still uses the JSON internally (config.rs::settings_schema) for
// defaults; the IPC just doesn't expose it to TS.
export interface StartupState {
  settings: Record<string, unknown>;
  recent_workspaces: string[];
  restore_bundle: RestoreWorkspaceResponse | null;
  /** Standalone compact-mode open (CLI arg / drag-drop of a Markdown-family file).
   *  Mutually exclusive with `restore_bundle`; the single-file watcher is
   *  already running by the time this returns. */
  standalone_file: FileContent | null;
}

export function getStartupState(): Promise<StartupState> {
  return invoke("get_startup_state");
}

// Window commands
export function showMainWindow(): Promise<void> {
  return getCurrentWindow().show();
}

// Image commands
export function saveClipboardImage(
  markdownFilePath: string,
  imageData: number[],
  format: string,
): Promise<{ relative_path: string; absolute_path: string }> {
  return invoke("save_clipboard_image", { markdownFilePath, imageData, format });
}

export const ASSET_UPLOAD_SECRET_PLACEHOLDER = "********";

export interface AssetUploadSettings {
  schemaVersion: 2;
  provider: "cloudflare-r2-worker";
  endpoint: string;
  apiKey: string;
  publicBaseUrl: string;
  prefix: string;
  maxBytes: number;
}

export interface AssetUploadCheckResult {
  ok: boolean;
  message: string;
}

export interface AssetImageUploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export function loadAssetUploadSettings(): Promise<AssetUploadSettings> {
  return invoke("load_asset_upload_settings");
}

export function saveAssetUploadSettings(
  settings: AssetUploadSettings,
): Promise<AssetUploadSettings> {
  return invoke("save_asset_upload_settings", { settings });
}

export function checkAssetUploadSettings(
  settings: AssetUploadSettings,
): Promise<AssetUploadCheckResult> {
  return invoke("check_asset_upload_settings", { settings });
}

export function uploadAssetImage(input: {
  name: string;
  contentType: string;
  imageData: number[];
}): Promise<AssetImageUploadResult> {
  return invoke("upload_asset_image", { input });
}

// AI commands
export type AiAgentProvider = "codex" | "claude";

export interface AiEnvVar {
  name: string;
  value: string;
}

export interface AiAgentSettings {
  command: string;
  env: AiEnvVar[];
  instruction: string;
  timeoutSeconds: number;
}

export interface AiSettings {
  schemaVersion: 1;
  provider: AiAgentProvider;
  agents: Record<AiAgentProvider, AiAgentSettings>;
}

export interface AiCheckResult {
  ok: boolean;
  message: string;
}

export interface AiMetadataSuggestion {
  title: string;
  description: string;
  tags: string[];
  slug: string;
}

export type AiDocumentReviewIssueSeverity = "info" | "warning" | "critical";

export interface AiDocumentReviewIssue {
  severity: AiDocumentReviewIssueSeverity;
  title: string;
  detail: string;
  suggestion: string;
}

export interface AiDocumentReview {
  summary: string;
  issues: AiDocumentReviewIssue[];
}

export interface AiActionInput {
  kind: "polish-document" | "rewrite-selection" | "generate-metadata" | "review-document";
  content: string;
  workspaceRoot?: string | null;
}

export interface AiActionResult {
  kind: AiActionInput["kind"];
  content: string;
  provider: AiAgentProvider;
  metadata?: AiMetadataSuggestion;
  review?: AiDocumentReview;
}

export function loadAiSettings(): Promise<AiSettings> {
  return invoke("load_ai_settings");
}

export function saveAiSettings(settings: AiSettings): Promise<AiSettings> {
  return invoke("save_ai_settings", { settings });
}

export function checkAiSettings(settings: AiSettings): Promise<AiCheckResult> {
  return invoke("check_ai_settings", { settings });
}

export function runAiAction(input: AiActionInput): Promise<AiActionResult> {
  return invoke("run_ai_action", { input });
}

import { invoke } from "@tauri-apps/api/core";
import type { FileContent } from "@/types/fs";
import type { RestoreWorkspaceResponse } from "./workspace";

export interface StartupState {
  settings: Record<string, unknown>;
  recent_workspaces: string[];
  restore_bundle: RestoreWorkspaceResponse | null;
  standalone_file: FileContent | null;
}

export function getStartupState(): Promise<StartupState> {
  return invoke("get_startup_state");
}

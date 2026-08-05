import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";

export function showMainWindow(): Promise<void> {
  return getCurrentWindow().show();
}

export function openExternalUrl(url: string): Promise<void> {
  return openUrl(url);
}

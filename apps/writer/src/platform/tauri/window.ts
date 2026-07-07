import { getCurrentWindow } from "@tauri-apps/api/window";

export function showMainWindow(): Promise<void> {
  return getCurrentWindow().show();
}

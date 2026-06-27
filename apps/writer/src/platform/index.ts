import { createBrowserAdapters } from "./browser-adapter";
import { createTauriAdapters } from "./tauri-adapter";
import type { PlatformAdapters } from "./ports";

export function createPlatformAdapters(): PlatformAdapters {
  return isTauriRuntime() ? createTauriAdapters() : createBrowserAdapters();
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export type { PlatformAdapters } from "./ports";

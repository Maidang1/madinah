import { createBrowserAdapters } from "./browser-adapter";
import { createElectronAdapters, isElectronRuntime } from "./electron-adapter";
import type { PlatformAdapters } from "./ports";

export function createPlatformAdapters(): PlatformAdapters {
  return isElectronRuntime() ? createElectronAdapters() : createBrowserAdapters();
}

export type { PlatformAdapters } from "./ports";

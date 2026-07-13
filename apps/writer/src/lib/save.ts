import { useSettingsStore } from "@/stores/settings-store";
import type { OpenFile } from "@/hooks/editor-api";
import { serializeDocument } from "@/lib/frontmatter";
import * as tauri from "@/lib/tauri";

const THROTTLE_MS = 1000;

/**
 * The slice of editor-store behavior the save engine needs. The store injects
 * it via `registerSaveStore` at startup so this `lib/` module never imports
 * `stores/editor-store` — that back-edge would invert the stores → lib layering
 * and form an import cycle (the store already imports the save engine).
 */
export interface SaveStoreAccess {
  getOpenFile: (path: string) => OpenFile | undefined;
  markSaved: (path: string, diskContent: string, hasNewerChanges: boolean) => void;
  setSaveError: (path: string, error: string) => void;
}

let storeAccess: SaveStoreAccess | null = null;

/** Wire the save engine to the editor store. Called once from editor-store at
 *  module init. */
export function registerSaveStore(access: SaveStoreAccess) {
  storeAccess = access;
}

function requireStore(): SaveStoreAccess {
  if (!storeAccess) {
    throw new Error("[save] used before registerSaveStore() — editor store not wired");
  }
  return storeAccess;
}

interface SaveController {
  lastSaveTime: number;
  timer: ReturnType<typeof setTimeout> | null;
  inFlight: boolean;
  pending: boolean;
  flushRequested: boolean;
  waiters: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }>;
}

const saveControllers = new Map<string, SaveController>();

function getSaveController(path: string): SaveController {
  let controller = saveControllers.get(path);
  if (!controller) {
    controller = {
      lastSaveTime: 0,
      timer: null,
      inFlight: false,
      pending: false,
      flushRequested: false,
      waiters: [],
    };
    saveControllers.set(path, controller);
  }
  return controller;
}

function clearSaveTimer(controller: SaveController) {
  if (!controller.timer) return;
  clearTimeout(controller.timer);
  controller.timer = null;
}

function cleanupSaveController(path: string, controller: SaveController) {
  if (
    controller.inFlight ||
    controller.pending ||
    controller.timer ||
    controller.waiters.length > 0
  )
    return;
  saveControllers.delete(path);
}

function settleSaveWaiters(controller: SaveController, error?: Error) {
  const waiters = controller.waiters.splice(0);
  for (const waiter of waiters) {
    if (error) waiter.reject(error);
    else waiter.resolve();
  }
}

export function scheduleSave(path: string) {
  const controller = getSaveController(path);
  controller.pending = true;
  queueSave(path, controller);
}

export function isSaveInFlight(path: string) {
  return saveControllers.get(path)?.inFlight === true;
}

export function cancelSave(path: string) {
  const controller = saveControllers.get(path);
  if (!controller) return;

  controller.pending = false;
  controller.flushRequested = false;
  clearSaveTimer(controller);
  settleSaveWaiters(controller, new Error(`Save cancelled for ${path}`));
  cleanupSaveController(path, controller);
}

/** Persist the latest document snapshot immediately and resolve only after all
 * edits observed during the write have reached disk. Publication uses this as
 * its durability boundary before invoking Git. */
export function flushSave(path: string): Promise<void> {
  const controller = getSaveController(path);
  controller.pending = true;
  controller.flushRequested = true;

  const completion = new Promise<void>((resolve, reject) => {
    controller.waiters.push({ resolve, reject });
  });

  clearSaveTimer(controller);
  if (!controller.inFlight) void performSave(path, controller);
  return completion;
}

function queueSave(path: string, controller: SaveController) {
  if (controller.inFlight) return;

  clearSaveTimer(controller);

  const elapsed = Date.now() - controller.lastSaveTime;
  if (elapsed >= THROTTLE_MS) {
    void performSave(path, controller);
    return;
  }

  controller.timer = setTimeout(() => {
    controller.timer = null;
    void performSave(path, controller);
  }, THROTTLE_MS - elapsed);
}

function applyFileProcessing(content: string): string {
  const settings = useSettingsStore.getState().settings;
  let result = content;

  if (settings["files.trim-trailing-whitespace"]) {
    result = result
      .split("\n")
      .map((line) => line.replace(/\s+$/, ""))
      .join("\n");
  }

  if (settings["files.insert-final-newline"]) {
    if (!result.endsWith("\n")) {
      result += "\n";
    }
  }

  return result;
}

function serializeForSave(file: OpenFile) {
  return applyFileProcessing(serializeDocument(file.frontmatter, file.content));
}

async function performSave(path: string, controller = getSaveController(path)) {
  if (controller.inFlight) return;

  const store = requireStore();
  const file = store.getOpenFile(path);
  if (!file || !file.isDirty) {
    controller.pending = false;
    settleSaveWaiters(controller);
    cleanupSaveController(path, controller);
    return;
  }

  controller.inFlight = true;
  controller.pending = false;
  controller.lastSaveTime = Date.now();

  const full = serializeForSave(file);
  let shouldReschedule = false;
  let terminalError: Error | undefined;

  try {
    await tauri.writeFile(path, full);

    const latestFile = store.getOpenFile(path);
    if (!latestFile) return;

    shouldReschedule = serializeForSave(latestFile) !== full;
    store.markSaved(path, full, shouldReschedule);
  } catch (err) {
    console.error(`[save] Failed to save ${path}:`, err);
    const message = err instanceof Error ? err.message : String(err);
    store.setSaveError(path, message);
    terminalError = err instanceof Error ? err : new Error(message);
  } finally {
    controller.inFlight = false;

    const needsFollowUpSave = controller.pending || shouldReschedule;
    if (needsFollowUpSave) {
      if (controller.flushRequested) void performSave(path, controller);
      else queueSave(path, controller);
    } else {
      controller.flushRequested = false;
      settleSaveWaiters(controller, terminalError);
      cleanupSaveController(path, controller);
    }
  }
}

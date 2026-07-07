import type { TitleSource } from "@/lib/frontmatter";
import type { DocumentStats } from "@/lib/document-stats";
import {
  deserializeLocation,
  locationBehavior,
  serializeLocation,
  type FileLocation,
  type Location,
  type SerializedLocation,
} from "@/components/editor-area/page-kinds";

export interface OpenFile {
  path: string;
  frontmatter: string | null;
  content: string;
  title: string;
  titleSource: TitleSource;
  diskContent: string;
  isDirty: boolean;
  isLoading: boolean;
  saveError: string | null;
  reloadVersion: number;
  scrollPos: number;
  cursorPos: number;
  displayDate: string | null;
  stats: DocumentStats;
}

export interface Tab {
  id: string;
  location: Location;
  back: Location[];
  forward: Location[];
}

export interface SessionTab {
  location: SerializedLocation;
  back: SerializedLocation[];
  forward: SerializedLocation[];
}

let tabSequence = 0;

function createTabId() {
  tabSequence += 1;
  return `tab-${tabSequence}`;
}

export function createLauncherTab(id = createTabId()): Tab {
  return { id, location: { kind: "launcher" }, back: [], forward: [] };
}

export function createFileTab(path: string, id = createTabId()): Tab {
  return { id, location: { kind: "file", path }, back: [], forward: [] };
}

export function createSettingsTab(id = createTabId()): Tab {
  return { id, location: { kind: "settings" }, back: [], forward: [] };
}

export function cloneTab(tab: Tab): Tab {
  return { ...tab, back: [...tab.back], forward: [...tab.forward] };
}

export function locationPaths(location: Location): string[] {
  return locationBehavior(location).paths(location);
}

export function locationPrimaryPath(location: Location): string | null {
  return locationBehavior(location).primaryPath(location);
}

export function deriveActiveFilePath(tabs: Tab[], activeTabId: string | null): string | null {
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  return activeTab ? locationPrimaryPath(activeTab.location) : null;
}

export function getTabIndex(tabs: Tab[], tabId: string) {
  return tabs.findIndex((tab) => tab.id === tabId);
}

export function getActiveTab(state: Pick<EditorSessionState, "tabs" | "activeTabId">) {
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null;
}

export function collectReferencedPaths(tabs: Tab[]) {
  const paths = new Set<string>();
  for (const tab of tabs) {
    for (const p of locationPaths(tab.location)) paths.add(p);
    for (const loc of tab.back) for (const p of locationPaths(loc)) paths.add(p);
    for (const loc of tab.forward) for (const p of locationPaths(loc)) paths.add(p);
  }
  return paths;
}

export function tabPaths(tab: Tab): string[] {
  const paths = new Set<string>();
  for (const p of locationPaths(tab.location)) paths.add(p);
  for (const loc of tab.back) for (const p of locationPaths(loc)) paths.add(p);
  for (const loc of tab.forward) for (const p of locationPaths(loc)) paths.add(p);
  return [...paths];
}

export function rewriteLocation(location: Location, from: string, to: string): Location | null {
  return locationBehavior(location).rewritePath(location as never, from, to) as Location | null;
}

export function removeFromLocation(location: Location, path: string): Location | null {
  return locationBehavior(location).removePath(location as never, path) as Location | null;
}

export function applyRewriteToTab(
  tab: Tab,
  rewrite: (loc: Location) => Location | null,
): Tab | null {
  const newLocation = rewrite(tab.location);
  if (!newLocation) return null;
  const back = tab.back.map(rewrite).filter((l): l is Location => l !== null);
  const forward = tab.forward.map(rewrite).filter((l): l is Location => l !== null);
  return { ...tab, location: newLocation, back, forward };
}

export function restoreSessionTabs(tabs: SessionTab[]): Tab[] {
  const restoredTabs: Tab[] = [];
  for (const sessionTab of tabs) {
    const location = deserializeLocation(sessionTab.location);
    if (!location) continue;
    const back = sessionTab.back.map((l) => deserializeLocation(l)).filter(isLocation);
    const forward = sessionTab.forward.map((l) => deserializeLocation(l)).filter(isLocation);
    restoredTabs.push({
      id: createTabId(),
      location,
      back,
      forward,
    });
  }
  return restoredTabs;
}

export function getEditorSessionSnapshot(state: Pick<EditorSessionState, "tabs" | "activeTabId">) {
  const tabs: SessionTab[] = [];
  let activeIndex: number | null = null;
  state.tabs.forEach((tab) => {
    const location = serializeLocation(tab.location);
    if (!location) return;
    const back = tab.back.map((l) => serializeLocation(l)).filter(isSerializedLocation);
    const forward = tab.forward.map((l) => serializeLocation(l)).filter(isSerializedLocation);
    const index = tabs.length;
    tabs.push({ location, back, forward });
    if (state.activeTabId && tab.id === state.activeTabId) {
      activeIndex = index;
    }
  });
  return { tabs, activeIndex };
}

interface EditorSessionState {
  tabs: Tab[];
  activeTabId: string | null;
}

function isLocation(location: Location | null): location is Location {
  return location !== null;
}

function isSerializedLocation(location: SerializedLocation | null): location is SerializedLocation {
  return location !== null;
}

export type { FileLocation, Location, SerializedLocation };

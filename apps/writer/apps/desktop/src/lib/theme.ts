import {
  getPrimaryDefs,
  SETTINGS_SCHEMA,
  suffixOf,
  type PrimarySuffix,
  type SettingDef,
  type ThemeMode,
} from "./settings-schema";

export type ThemePreference = "system" | "light" | "dark";

let systemThemeCleanup: (() => void) | null = null;
// Cached so the OS dark/light listener can re-derive when system flips.
// The settings-store is the only caller of `applyTheme` and always passes the
// latest settings, so we just stash them here for the listener's use.
let lastSettings: Record<string, unknown> = {};

function setThemeAttribute(isDark: boolean) {
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
}

function resolveMode(preference: ThemePreference): ThemeMode {
  if (preference === "dark" || preference === "light") return preference;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** How the translucent/contrast sliders translate into CSS-var values. The CSS
 *  expects normalized inputs (`--bg-opacity` 0–1, `--contrast` 0–2), not the
 *  raw slider ranges the user manipulates, so the mapping happens here rather
 *  than as a 1:1 cssVar binding. */
const DERIVED_PRIMARIES: Partial<Record<PrimarySuffix, (v: unknown) => [string, string]>> = {
  translucent: (v) => {
    const t = clamp(Number(v) || 0, 0, 100);
    return ["--bg-opacity", String(1 - (t / 100) * 0.95)];
  },
  contrast: (v) => {
    // Slider 0-100 maps to effective 0.2-1.0
    const c = clamp(Number(v) || 0, 0, 100);
    return ["--contrast", String(0.2 + (c / 100) * 0.8)];
  },
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Coerce an unknown setting value into a CSS string. Returns null for
 *  values we can't sensibly stringify (objects, arrays) so the caller can
 *  skip them rather than write `[object Object]` into a CSS variable. */
function formatCssValue(value: unknown, format: SettingDef["cssFormat"]): string | null {
  let str: string;
  if (typeof value === "string") str = value;
  else if (typeof value === "number") str = value.toString();
  else return null;
  return format === "px" ? `${str}px` : str;
}

/** Push the active mode's primaries onto :root. Direct 1:1 bindings come
 *  from each schema entry's `cssVar`; derived tokens (translucent → bg-opacity,
 *  contrast → /100) are mapped explicitly via `DERIVED_PRIMARIES`. */
function applyPrimaries(mode: ThemeMode, settings: Record<string, unknown>) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const def of getPrimaryDefs(mode)) {
    const value = settings[def.key];
    if (value === undefined || value === null) continue;
    const derive = DERIVED_PRIMARIES[suffixOf(mode, def.key)];
    if (derive) {
      const [varName, formatted] = derive(value);
      root.style.setProperty(varName, formatted);
    } else if (def.cssVar) {
      const formatted = formatCssValue(value, def.cssFormat);
      if (formatted !== null) root.style.setProperty(def.cssVar, formatted);
    }
  }
}

/** Generic side effect: any non-theme schema entry with a `cssVar` binding gets
 *  pushed to :root automatically. New CSS-var-driven settings declare the
 *  binding in JSON; no view code needs to change. Mode-aware tokens
 *  (`theme.{mode}.*`) are handled by `applyPrimaries` instead — only the
 *  active mode's values flow through. */
export function applyCssVarBindings(settings: Record<string, unknown>) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const def of SETTINGS_SCHEMA) {
    if (!def.cssVar) continue;
    if (def.key.startsWith("theme.")) continue;
    const value = settings[def.key];
    if (value === undefined || value === null) continue;
    const formatted = formatCssValue(value, def.cssFormat);
    if (formatted !== null) root.style.setProperty(def.cssVar, formatted);
  }
}

function pushForMode(mode: ThemeMode, settings: Record<string, unknown>) {
  setThemeAttribute(mode === "dark");
  applyPrimaries(mode, settings);
}

/**
 * Apply the active theme: sets data-theme attribute, pushes primaries.
 * Re-listens for system changes when preference is "system". Called only
 * by the settings store as a side effect of every settings change.
 */
export function applyTheme(preference: unknown, settings: Record<string, unknown>) {
  if (typeof document === "undefined") return;

  lastSettings = settings;

  if (systemThemeCleanup) {
    systemThemeCleanup();
    systemThemeCleanup = null;
  }

  const pref: ThemePreference =
    preference === "dark" || preference === "light" || preference === "system"
      ? preference
      : "system";

  if (pref !== "system") {
    pushForMode(pref, settings);
    return;
  }

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  pushForMode(mq.matches ? "dark" : "light", settings);

  const handler = (e: MediaQueryListEvent) => {
    pushForMode(e.matches ? "dark" : "light", lastSettings);
  };
  mq.addEventListener("change", handler);
  systemThemeCleanup = () => mq.removeEventListener("change", handler);
}

/** Resolve the active mode given a preference and current system state. */
export function activeMode(preference: unknown): ThemeMode {
  const pref: ThemePreference =
    preference === "dark" || preference === "light" || preference === "system"
      ? preference
      : "system";
  return resolveMode(pref);
}

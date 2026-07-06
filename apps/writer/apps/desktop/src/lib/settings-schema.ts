/**
 * Typed registry built from the JSON sources of truth.
 *
 *   - `apps/desktop/shared/settings.schema.json`
 *       The settings *contract*: keys, types, defaults, labels, descriptions,
 *       and CSS-var bindings. Read by Rust (`include_str!` in config.rs) and
 *       imported here statically so TypeScript can derive literal types.
 *
 *   - `apps/desktop/shared/themes/<slug>/{light,dark}.json`
 *       Default theme *values*. Each preset is a folder with one JSON file
 *       per mode, holding just the primary values. Picked up by glob so
 *       dropping a new folder registers a new preset — no TS edits needed.
 *       The folder slug becomes the display name (kebab-case → Title Case).
 *
 * Splitting contract from values follows the same separation Rust uses: the
 * schema describes how a setting works; presets are just curated bundles of
 * values that map onto those settings.
 */

import schemaFile from "@shared/settings.schema.json";

// ---------- Typed schema (contract) ----------

type RawSchema = typeof schemaFile;

type RawEntry = RawSchema["settings"][number];

/** Map a schema entry's `type` literal to the runtime value type. Settings
 *  with `cssFormat: "px"` are still numbers in the store — formatting only
 *  happens when writing to CSS. */
type ValueOf<T extends RawEntry> = T["type"] extends "boolean"
  ? boolean
  : T["type"] extends "number" | "range"
    ? number
    : T["type"] extends "list"
      ? string[]
      : string;

/** Compile-time map from setting key → expected runtime type. Drives the
 *  typed `useSetting<K>` accessor and store typings. */
export type SettingsMap = {
  [E in RawEntry as E["key"]]: ValueOf<E>;
};

export type SettingKey = keyof SettingsMap;

/** Runtime SettingDef shape exposed to the rest of the app. This is the
 *  generalized form (string-typed `type`, optional fields) — the JSON gives
 *  us tighter literal types via `RawEntry`, but consumers rarely need them.
 *  Mirrors `apps/desktop/src-tauri/src/config.rs::SettingDef`. */
export interface SettingDef {
  key: string;
  label: string;
  description: string;
  category: string;
  type: "string" | "number" | "boolean" | "enum" | "list" | "color" | "range";
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  cssVar?: string;
  cssFormat?: "px" | "raw";
  default: unknown;
}

export const SETTINGS_SCHEMA: SettingDef[] = schemaFile.settings as SettingDef[];

// ---------- Theme primaries ----------

export type ThemeMode = "light" | "dark";

export type PrimarySuffix =
  | "accent"
  | "background"
  | "foreground"
  | "ui-font"
  | "editor-font"
  | "translucent"
  | "contrast";

/** A flat record keyed by the kebab-case suffix of `theme.{mode}.{suffix}`.
 *  Mirrors the JSON schema names so iteration code uses the same key as the
 *  schema entry without any mapping. */
export type PrimarySet = Record<PrimarySuffix, string | number>;

const PRIMARY_PREFIX = (mode: ThemeMode) => `theme.${mode}.`;

function presetKey(mode: ThemeMode): string {
  return `theme.${mode}.preset`;
}

/** Schema entries describing the editable primaries for a theme mode. UI
 *  iterates these, write paths iterate these, preset compare iterates these.
 *  The hardcoded list lives only in the JSON schema. */
export function getPrimaryDefs(mode: ThemeMode): SettingDef[] {
  const prefix = PRIMARY_PREFIX(mode);
  const presetK = presetKey(mode);
  return SETTINGS_SCHEMA.filter((def) => def.key.startsWith(prefix) && def.key !== presetK);
}

export function suffixOf(mode: ThemeMode, key: string): PrimarySuffix {
  return key.slice(PRIMARY_PREFIX(mode).length) as PrimarySuffix;
}

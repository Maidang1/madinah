import { useSettingsStore } from "@/stores/settings-store";
import type { SettingsMap, SettingKey } from "@/lib/settings-schema";

export type { SettingsMap, SettingKey };

/** Subscribe to a single setting by key. Component re-renders only when this
 *  key changes (Zustand uses Object.is on the selector result). The return
 *  type is derived from the JSON schema, so callers don't cast. */
export function useSetting<K extends SettingKey>(key: K): SettingsMap[K] | undefined {
  return useSettingsStore((state) => state.settings[key as string]) as SettingsMap[K] | undefined;
}

/** Stable function reference for writing a setting. Function identity in the
 *  store doesn't change, so this hook never causes re-renders. */
export function useSetSetting() {
  return useSettingsStore((state) => state.setSetting);
}

/** Stable function reference for resetting a setting to its default. */
export function useResetSetting() {
  return useSettingsStore((state) => state.resetSetting);
}

/** Subscribe to the entire flat settings record. Use sparingly — every
 *  setting change re-renders the consumer. Prefer `useSetting<K>(key)` when
 *  the component only reads a few keys. The settings panel uses this because
 *  it inspects every entry for the "modified" indicator. */
export function useAllSettings() {
  return useSettingsStore((state) => state.settings);
}

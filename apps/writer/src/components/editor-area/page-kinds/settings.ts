import { definePageKind } from "./types";

export type SettingsLocation = { kind: "settings" };

// The view (SettingsPanel) is registered in `./views`.
export const settingsKind = definePageKind<"settings", SettingsLocation>({
  kind: "settings",
  title: () => "Settings",
  description: "App preferences",
  keepAlive: true,
});

import { definePageKind } from "./types";

export type LauncherLocation = { kind: "launcher" };

// Launcher is transient — `serialize: () => null` tells the session writer
// to skip it. Every other behavior takes the default from `definePageKind`:
// stateless `fromPayload`, no paths, identity rewrite/remove, no keep-alive.
// The view (NewTabPage) is registered in `./views`.
export const launcherKind = definePageKind<"launcher", LauncherLocation>({
  kind: "launcher",
  title: () => "New tab",
  description: "Open a new tab",
  serialize: () => null,
});

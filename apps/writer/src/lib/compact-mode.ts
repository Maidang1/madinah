import type { WorkspaceChromeMode } from "@/stores/workspace-store";

/**
 * Resolve the chrome mode a window should render. Compact chrome only
 * exists in standalone windows: a window hosting a workspace root always
 * renders workspace chrome, regardless of how `chromeMode` was set.
 */
export function getWorkspaceChromeMode(
  root: string | null,
  chromeMode: WorkspaceChromeMode,
): WorkspaceChromeMode {
  if (root) return "workspace";
  return chromeMode;
}

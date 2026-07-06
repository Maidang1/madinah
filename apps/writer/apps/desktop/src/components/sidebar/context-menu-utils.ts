export type Platform = "macos" | "windows" | "linux";

/**
 * Detect the platform from `navigator.userAgent`. Used purely to pick the
 * "Reveal in Finder / Explorer / Show in Folder" label.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "linux";
  const ua = navigator.userAgent;
  if (/Mac|iPhone|iPad|iPod/i.test(ua)) return "macos";
  if (/Win/i.test(ua)) return "windows";
  return "linux";
}

export function revealLabelForPlatform(platform: Platform): string {
  switch (platform) {
    case "macos":
      return "Reveal in Finder";
    case "windows":
      return "Reveal in Explorer";
    case "linux":
      return "Show in Folder";
  }
}

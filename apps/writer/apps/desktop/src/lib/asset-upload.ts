import { ASSET_UPLOAD_SECRET_PLACEHOLDER, type AssetUploadSettings } from "@/lib/tauri";

export const SUPPORTED_ASSET_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export function canAttemptAssetUpload(settings: AssetUploadSettings): boolean {
  return Boolean(
    settings.provider === "cloudflare-r2-worker" &&
    settings.endpoint.trim() &&
    settings.publicBaseUrl.trim() &&
    settings.prefix.trim() &&
    (settings.apiKey.trim() || settings.apiKey === ASSET_UPLOAD_SECRET_PLACEHOLDER),
  );
}

export function isSupportedAssetImage(file: File): boolean {
  return SUPPORTED_ASSET_IMAGE_TYPES.has(file.type);
}

export function isWithinAssetUploadLimit(file: File, settings: AssetUploadSettings): boolean {
  return file.size <= settings.maxBytes;
}

export function formatBytes(value: number): string {
  if (value >= 1024 * 1024) return `${Math.round(value / 1024 / 1024)}MB`;
  if (value >= 1024) return `${Math.round(value / 1024)}KB`;
  return `${value}B`;
}

import type { AssetUploadSettings } from "../../domain/assets";
import {
  hasRequiredAssetUploadSettings,
  normalizeAssetUploadSettings,
} from "../../domain/assets";
import type { AssetUploadAdapter } from "../../platform/ports";

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export interface CreateImageUploadHandlerInput {
  assetUpload: AssetUploadAdapter;
  settings: AssetUploadSettings;
  setStatus?: (status: string) => void;
}

export function createImageUploadHandler({
  assetUpload,
  settings,
  setStatus,
}: CreateImageUploadHandlerInput): (image: File | null) => Promise<string> {
  const normalizedSettings = normalizeAssetUploadSettings(settings);

  return async (image: File | null) => {
    if (!image) {
      throw new Error("No image found in clipboard");
    }
    if (!assetUpload.isAvailable) {
      throw new Error("Image uploads require the desktop app");
    }
    if (!hasRequiredAssetUploadSettings(normalizedSettings)) {
      throw new Error("Asset upload settings are incomplete");
    }
    if (!SUPPORTED_IMAGE_TYPES.has(image.type)) {
      throw new Error(`Unsupported image type: ${image.type || "unknown"}`);
    }
    if (image.size > normalizedSettings.maxBytes) {
      throw new Error(
        `Image is larger than ${formatBytes(normalizedSettings.maxBytes)}`,
      );
    }

    setStatus?.("Uploading image");
    try {
      const dataBase64 = await fileToBase64(image);
      const result = await assetUpload.uploadImage({
        name: image.name || "image",
        contentType: image.type,
        size: image.size,
        dataBase64,
      });
      setStatus?.("Image uploaded");
      return result.url;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus?.(message);
      throw error;
    }
  };
}

export async function fileToBase64(file: File): Promise<string> {
  return arrayBufferToBase64(await file.arrayBuffer());
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) {
    return `${Math.round(value / 1024 / 1024)}MB`;
  }
  if (value >= 1024) {
    return `${Math.round(value / 1024)}KB`;
  }
  return `${value}B`;
}

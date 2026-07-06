import {
  canAttemptAssetUpload,
  formatBytes,
  isSupportedAssetImage,
  isWithinAssetUploadLimit,
} from "@/lib/asset-upload";
import { formatMarkdownDestination } from "@/lib/paths";
import * as tauri from "@/lib/tauri";

const MAX_LOCAL_IMAGE_SIZE = 5 * 1024 * 1024;
const LOCAL_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export interface PastedImageMarkdown {
  alt: string;
  destination: string;
}

export async function resolvePastedImageMarkdown(
  file: File,
  markdownFilePath: string,
): Promise<PastedImageMarkdown> {
  const buffer = await file.arrayBuffer();
  const imageData = Array.from(new Uint8Array(buffer));
  const alt = file.name || "image";
  const uploadSettings = await tauri.loadAssetUploadSettings();

  if (canAttemptAssetUpload(uploadSettings)) {
    if (!isSupportedAssetImage(file)) {
      throw new Error(`Unsupported image type: ${file.type || "unknown"}`);
    }
    if (!isWithinAssetUploadLimit(file, uploadSettings)) {
      throw new Error(`Image is larger than ${formatBytes(uploadSettings.maxBytes)}`);
    }

    const result = await tauri.uploadAssetImage({
      name: alt,
      contentType: file.type,
      imageData,
    });
    return { alt, destination: result.url };
  }

  if (!LOCAL_IMAGE_TYPES.has(file.type)) {
    throw new Error(`Unsupported local image type: ${file.type || "unknown"}`);
  }
  if (buffer.byteLength > MAX_LOCAL_IMAGE_SIZE) {
    throw new Error(`Image is larger than ${formatBytes(MAX_LOCAL_IMAGE_SIZE)}`);
  }

  const format = file.type.split("/")[1] || "png";
  const result = await tauri.saveClipboardImage(markdownFilePath, imageData, format);
  return {
    alt,
    destination: formatMarkdownDestination(result.relative_path),
  };
}

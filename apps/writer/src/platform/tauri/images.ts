import { invoke } from "@tauri-apps/api/core";

export function saveClipboardImage(
  markdownFilePath: string,
  imageData: number[],
  format: string,
): Promise<{ relative_path: string; absolute_path: string }> {
  return invoke("save_clipboard_image", { markdownFilePath, imageData, format });
}

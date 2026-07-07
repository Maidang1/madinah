import { invoke } from "@tauri-apps/api/core";

export const ASSET_UPLOAD_SECRET_PLACEHOLDER = "********";

export interface AssetUploadSettings {
  schemaVersion: 2;
  provider: "cloudflare-r2-worker";
  endpoint: string;
  apiKey: string;
  publicBaseUrl: string;
  prefix: string;
  maxBytes: number;
}

export interface AssetUploadCheckResult {
  ok: boolean;
  message: string;
}

export interface AssetImageUploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export function loadAssetUploadSettings(): Promise<AssetUploadSettings> {
  return invoke("load_asset_upload_settings");
}

export function saveAssetUploadSettings(
  settings: AssetUploadSettings,
): Promise<AssetUploadSettings> {
  return invoke("save_asset_upload_settings", { settings });
}

export function checkAssetUploadSettings(
  settings: AssetUploadSettings,
): Promise<AssetUploadCheckResult> {
  return invoke("check_asset_upload_settings", { settings });
}

export function uploadAssetImage(input: {
  name: string;
  contentType: string;
  imageData: number[];
}): Promise<AssetImageUploadResult> {
  return invoke("upload_asset_image", { input });
}

export const ASSET_UPLOAD_SECRET_PLACEHOLDER = "********";
export const DEFAULT_ASSET_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

export interface AssetUploadSettings {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  prefix: string;
  maxBytes: number;
}

export interface AssetUploadCheckResult {
  ok: boolean;
  message: string;
}

export interface AssetImageUploadInput {
  name: string;
  contentType: string;
  size: number;
  dataBase64: string;
}

export interface AssetImageUploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export function createDefaultAssetUploadSettings(): AssetUploadSettings {
  return {
    accountId: "",
    bucket: "madinah-assets",
    accessKeyId: "",
    secretAccessKey: "",
    publicBaseUrl: "https://assets.felixwliu.cn",
    prefix: "images/writer",
    maxBytes: DEFAULT_ASSET_UPLOAD_MAX_BYTES,
  };
}

export function normalizeAssetUploadSettings(
  value: unknown,
): AssetUploadSettings {
  const fallback = createDefaultAssetUploadSettings();
  if (!isRecord(value)) return fallback;

  return {
    accountId: normalizeString(value.accountId),
    bucket: normalizeString(value.bucket) || fallback.bucket,
    accessKeyId: normalizeString(value.accessKeyId),
    secretAccessKey: normalizeString(value.secretAccessKey),
    publicBaseUrl:
      normalizePublicBaseUrl(value.publicBaseUrl) || fallback.publicBaseUrl,
    prefix: normalizePrefix(value.prefix) || fallback.prefix,
    maxBytes: normalizeMaxBytes(value.maxBytes, fallback.maxBytes),
  };
}

export function hasRequiredAssetUploadSettings(
  settings: AssetUploadSettings,
): boolean {
  return Boolean(
    settings.accountId.trim() &&
      settings.bucket.trim() &&
      settings.accessKeyId.trim() &&
      settings.secretAccessKey.trim() &&
      settings.secretAccessKey !== ASSET_UPLOAD_SECRET_PLACEHOLDER &&
      settings.publicBaseUrl.trim(),
  );
}

export function mergeAssetUploadSettingsForSave(
  draft: AssetUploadSettings,
  current: AssetUploadSettings,
): AssetUploadSettings {
  const normalizedDraft = normalizeAssetUploadSettings(draft);
  const normalizedCurrent = normalizeAssetUploadSettings(current);

  if (normalizedDraft.secretAccessKey === ASSET_UPLOAD_SECRET_PLACEHOLDER) {
    return {
      ...normalizedDraft,
      secretAccessKey: normalizedCurrent.secretAccessKey,
    };
  }

  return normalizedDraft;
}

export function maskAssetUploadSecret(
  settings: AssetUploadSettings,
): AssetUploadSettings {
  return {
    ...settings,
    secretAccessKey: settings.secretAccessKey
      ? ASSET_UPLOAD_SECRET_PLACEHOLDER
      : "",
  };
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePublicBaseUrl(value: unknown): string {
  return normalizeString(value).replace(/\/+$/u, "");
}

function normalizePrefix(value: unknown): string {
  return normalizeString(value).replace(/^\/+|\/+$/gu, "");
}

function normalizeMaxBytes(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1024, Math.min(500 * 1024 * 1024, Math.round(numeric)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

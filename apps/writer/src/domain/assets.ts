export const ASSET_UPLOAD_SECRET_PLACEHOLDER = "********";
export const DEFAULT_ASSET_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

export type AssetUploadProvider = "cloudflare-r2-worker";

export interface AssetUploadSettings {
  schemaVersion: 2;
  provider: AssetUploadProvider;
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
    schemaVersion: 2,
    provider: "cloudflare-r2-worker",
    endpoint: "",
    apiKey: "",
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
    schemaVersion: 2,
    provider: normalizeProvider(value.provider),
    endpoint: normalizeBaseUrl(value.endpoint),
    apiKey: normalizeString(value.apiKey),
    publicBaseUrl:
      normalizeBaseUrl(value.publicBaseUrl ?? value.customDomain) ||
      fallback.publicBaseUrl,
    prefix: normalizePrefix(value.prefix) || fallback.prefix,
    maxBytes: normalizeMaxBytes(value.maxBytes, fallback.maxBytes),
  };
}

export function hasRequiredAssetUploadSettings(
  settings: AssetUploadSettings,
): boolean {
  return Boolean(
    settings.provider &&
      settings.endpoint.trim() &&
      settings.apiKey.trim() &&
      settings.apiKey !== ASSET_UPLOAD_SECRET_PLACEHOLDER &&
      settings.publicBaseUrl.trim(),
  );
}

export function mergeAssetUploadSettingsForSave(
  draft: AssetUploadSettings,
  current: AssetUploadSettings,
): AssetUploadSettings {
  const normalizedDraft = normalizeAssetUploadSettings(draft);
  const normalizedCurrent = normalizeAssetUploadSettings(current);

  if (normalizedDraft.apiKey === ASSET_UPLOAD_SECRET_PLACEHOLDER) {
    return {
      ...normalizedDraft,
      apiKey: normalizedCurrent.apiKey,
    };
  }

  return normalizedDraft;
}

export function maskAssetUploadSecret(
  settings: AssetUploadSettings,
): AssetUploadSettings {
  return {
    ...settings,
    apiKey: settings.apiKey ? ASSET_UPLOAD_SECRET_PLACEHOLDER : "",
  };
}

function normalizeProvider(_value: unknown): AssetUploadProvider {
  return "cloudflare-r2-worker";
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBaseUrl(value: unknown): string {
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

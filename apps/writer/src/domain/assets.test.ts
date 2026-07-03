import { describe, expect, it } from "vitest";
import {
  ASSET_UPLOAD_SECRET_PLACEHOLDER,
  createDefaultAssetUploadSettings,
  hasRequiredAssetUploadSettings,
  maskAssetUploadSecret,
  mergeAssetUploadSettingsForSave,
  normalizeAssetUploadSettings,
} from "./assets";

describe("asset upload settings", () => {
  it("uses the Madinah worker asset defaults", () => {
    expect(createDefaultAssetUploadSettings()).toMatchObject({
      schemaVersion: 2,
      provider: "cloudflare-r2-worker",
      endpoint: "",
      publicBaseUrl: "https://assets.felixwliu.cn",
      prefix: "images/writer",
      maxBytes: 25 * 1024 * 1024,
    });
  });

  it("normalizes stored values and clamps max bytes", () => {
    expect(
      normalizeAssetUploadSettings({
        provider: "cloudflare-r2-worker",
        endpoint: " https://upload.example.com/ ",
        apiKey: " key ",
        publicBaseUrl: "https://assets.example.com/",
        prefix: "/images/paste/",
        maxBytes: 1,
      }),
    ).toMatchObject({
      schemaVersion: 2,
      provider: "cloudflare-r2-worker",
      endpoint: "https://upload.example.com",
      apiKey: "key",
      publicBaseUrl: "https://assets.example.com",
      prefix: "images/paste",
      maxBytes: 1024,
    });
  });

  it("migrates legacy R2 settings to the worker shape", () => {
    expect(
      normalizeAssetUploadSettings({
        accountId: "legacy-account",
        bucket: "legacy-bucket",
        accessKeyId: "legacy-access-key",
        secretAccessKey: "legacy-secret",
        publicBaseUrl: "https://assets.example.com/",
        prefix: "/images/legacy/",
        maxBytes: 2048,
      }),
    ).toMatchObject({
      endpoint: "",
      apiKey: "",
      publicBaseUrl: "https://assets.example.com",
      prefix: "images/legacy",
      maxBytes: 2048,
    });
  });

  it("masks and preserves existing API keys", () => {
    const current = {
      ...createDefaultAssetUploadSettings(),
      endpoint: "https://upload.example.com",
      apiKey: "stored-key",
    };
    const draft = {
      ...current,
      apiKey: ASSET_UPLOAD_SECRET_PLACEHOLDER,
      prefix: "images/new",
    };

    expect(maskAssetUploadSecret(current).apiKey).toBe(
      ASSET_UPLOAD_SECRET_PLACEHOLDER,
    );
    expect(mergeAssetUploadSettingsForSave(draft, current)).toMatchObject({
      apiKey: "stored-key",
      prefix: "images/new",
    });
  });

  it("requires a complete unmasked endpoint and API key before upload", () => {
    const settings = createDefaultAssetUploadSettings();

    expect(hasRequiredAssetUploadSettings(settings)).toBe(false);
    expect(
      hasRequiredAssetUploadSettings({
        ...settings,
        endpoint: "https://upload.example.com",
        apiKey: "key",
      }),
    ).toBe(true);
    expect(
      hasRequiredAssetUploadSettings({
        ...settings,
        endpoint: "https://upload.example.com",
        apiKey: ASSET_UPLOAD_SECRET_PLACEHOLDER,
      }),
    ).toBe(false);
  });
});

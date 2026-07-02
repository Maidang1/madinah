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
  it("uses the Madinah R2 asset defaults", () => {
    expect(createDefaultAssetUploadSettings()).toMatchObject({
      bucket: "madinah-assets",
      publicBaseUrl: "https://assets.felixwliu.cn",
      prefix: "images/writer",
      maxBytes: 25 * 1024 * 1024,
    });
  });

  it("normalizes stored values and clamps max bytes", () => {
    expect(
      normalizeAssetUploadSettings({
        accountId: " account ",
        bucket: "",
        accessKeyId: " key ",
        secretAccessKey: " secret ",
        publicBaseUrl: "https://assets.example.com/",
        prefix: "/images/paste/",
        maxBytes: 1,
      }),
    ).toMatchObject({
      accountId: "account",
      bucket: "madinah-assets",
      accessKeyId: "key",
      secretAccessKey: "secret",
      publicBaseUrl: "https://assets.example.com",
      prefix: "images/paste",
      maxBytes: 1024,
    });
  });

  it("masks and preserves existing secrets", () => {
    const current = {
      ...createDefaultAssetUploadSettings(),
      secretAccessKey: "stored-secret",
    };
    const draft = {
      ...current,
      secretAccessKey: ASSET_UPLOAD_SECRET_PLACEHOLDER,
      prefix: "images/new",
    };

    expect(maskAssetUploadSecret(current).secretAccessKey).toBe(
      ASSET_UPLOAD_SECRET_PLACEHOLDER,
    );
    expect(mergeAssetUploadSettingsForSave(draft, current)).toMatchObject({
      secretAccessKey: "stored-secret",
      prefix: "images/new",
    });
  });

  it("requires complete unmasked credentials before upload", () => {
    const settings = createDefaultAssetUploadSettings();

    expect(hasRequiredAssetUploadSettings(settings)).toBe(false);
    expect(
      hasRequiredAssetUploadSettings({
        ...settings,
        accountId: "account",
        accessKeyId: "key",
        secretAccessKey: "secret",
      }),
    ).toBe(true);
    expect(
      hasRequiredAssetUploadSettings({
        ...settings,
        accountId: "account",
        accessKeyId: "key",
        secretAccessKey: ASSET_UPLOAD_SECRET_PLACEHOLDER,
      }),
    ).toBe(false);
  });
});

import { describe, expect, test } from "vite-plus/test";
import { ASSET_UPLOAD_SECRET_PLACEHOLDER, type AssetUploadSettings } from "../src/lib/tauri";
import {
  canAttemptAssetUpload,
  formatBytes,
  isSupportedAssetImage,
  isWithinAssetUploadLimit,
} from "../src/lib/asset-upload";

describe("asset upload helpers", () => {
  test("allows masked settings from the backend to trigger upload attempts", () => {
    expect(canAttemptAssetUpload(completeSettings())).toBe(true);
    expect(
      canAttemptAssetUpload({
        ...completeSettings(),
        apiKey: ASSET_UPLOAD_SECRET_PLACEHOLDER,
      }),
    ).toBe(true);
  });

  test("rejects incomplete upload settings before remote paste upload", () => {
    expect(canAttemptAssetUpload({ ...completeSettings(), endpoint: "" })).toBe(false);
    expect(canAttemptAssetUpload({ ...completeSettings(), apiKey: "" })).toBe(false);
    expect(canAttemptAssetUpload({ ...completeSettings(), publicBaseUrl: "" })).toBe(false);
  });

  test("accepts the image formats supported by the worker path", () => {
    expect(isSupportedAssetImage(new File(["x"], "image.png", { type: "image/png" }))).toBe(true);
    expect(isSupportedAssetImage(new File(["x"], "image.gif", { type: "image/gif" }))).toBe(true);
    expect(isSupportedAssetImage(new File(["x"], "image.tiff", { type: "image/tiff" }))).toBe(
      false,
    );
  });

  test("checks max upload size in bytes", () => {
    const settings = { ...completeSettings(), maxBytes: 4 };

    expect(
      isWithinAssetUploadLimit(new File([new Uint8Array([1, 2, 3, 4])], "image.png"), settings),
    ).toBe(true);
    expect(
      isWithinAssetUploadLimit(new File([new Uint8Array([1, 2, 3, 4, 5])], "image.png"), settings),
    ).toBe(false);
  });

  test("formats byte values for paste errors", () => {
    expect(formatBytes(512)).toBe("512B");
    expect(formatBytes(2048)).toBe("2KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2MB");
  });
});

function completeSettings(): AssetUploadSettings {
  return {
    schemaVersion: 2,
    provider: "cloudflare-r2-worker",
    endpoint: "https://upload.example.com",
    apiKey: "key",
    publicBaseUrl: "https://assets.example.com",
    prefix: "images/writer",
    maxBytes: 25 * 1024 * 1024,
  };
}

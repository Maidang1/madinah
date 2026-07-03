import { describe, expect, it, vi } from "vitest";
import type { AssetUploadAdapter } from "../../platform/ports";
import { createDefaultAssetUploadSettings } from "../../domain/assets";
import { createImageUploadHandler, fileToBase64 } from "./image-upload";

describe("image upload handler", () => {
  it("converts a pasted image file and returns the uploaded URL", async () => {
    const uploadImage = vi.fn(async () => ({
      key: "images/writer/2026/06/hash-image.png",
      url: "https://assets.felixwliu.cn/images/writer/2026/06/hash-image.png",
      size: 4,
      contentType: "image/png",
    }));
    const status: string[] = [];
    const handler = createImageUploadHandler({
      assetUpload: createAssetUploadAdapter({ uploadImage }),
      settings: completeSettings(),
      setStatus: (message) => status.push(message),
    });

    await expect(
      handler(new File([new Uint8Array([1, 2, 3, 4])], "Pasted.png", {
        type: "image/png",
      })),
    ).resolves.toBe(
      "https://assets.felixwliu.cn/images/writer/2026/06/hash-image.png",
    );

    expect(uploadImage).toHaveBeenCalledWith({
      name: "Pasted.png",
      contentType: "image/png",
      size: 4,
      dataBase64: "AQIDBA==",
    });
    expect(status).toEqual(["Uploading image", "Image uploaded"]);
  });

  it("rejects missing desktop adapter and incomplete settings", async () => {
    const disabledHandler = createImageUploadHandler({
      assetUpload: createAssetUploadAdapter({ isAvailable: false }),
      settings: completeSettings(),
    });
    await expect(
      disabledHandler(new File([new Uint8Array([1])], "image.png", { type: "image/png" })),
    ).rejects.toThrow("desktop app");

    const incompleteHandler = createImageUploadHandler({
      assetUpload: createAssetUploadAdapter(),
      settings: createDefaultAssetUploadSettings(),
    });
    await expect(
      incompleteHandler(new File([new Uint8Array([1])], "image.png", { type: "image/png" })),
    ).rejects.toThrow("Asset upload settings are incomplete");
  });

  it("rejects unsupported and oversized images", async () => {
    const handler = createImageUploadHandler({
      assetUpload: createAssetUploadAdapter(),
      settings: {
        ...completeSettings(),
        maxBytes: 1024,
      },
    });

    await expect(
      handler(new File(["text"], "note.txt", { type: "text/plain" })),
    ).rejects.toThrow("Unsupported image type");
    await expect(
      handler(new File([new Uint8Array(1025)], "image.png", { type: "image/png" })),
    ).rejects.toThrow("larger");
  });

  it("converts files to base64", async () => {
    await expect(
      fileToBase64(
        new File([new Uint8Array([1, 2, 3, 4])], "image.png", {
          type: "image/png",
        }),
      ),
    ).resolves.toBe("AQIDBA==");
  });
});

function completeSettings() {
  return {
    ...createDefaultAssetUploadSettings(),
    endpoint: "https://upload.example.com",
    apiKey: "key",
  };
}

function createAssetUploadAdapter(
  patch: Partial<AssetUploadAdapter> = {},
): AssetUploadAdapter {
  return {
    isAvailable: true,
    loadSettings: vi.fn(async () => completeSettings()),
    saveSettings: vi.fn(async (settings) => settings),
    checkSettings: vi.fn(async () => ({ ok: true, message: "Connected" })),
    uploadImage: vi.fn(async () => ({
      key: "images/writer/2026/06/hash-image.png",
      url: "https://assets.felixwliu.cn/images/writer/2026/06/hash-image.png",
      size: 1,
      contentType: "image/png",
    })),
    ...patch,
  };
}

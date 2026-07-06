import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { formatMarkdownDestination, getParentDir, resolveImagePath } from "../src/lib/paths";
import { resolvePastedImageMarkdown } from "../src/components/editor-area/image-paste-handler";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

beforeEach(async () => {
  const { invoke } = await import("@tauri-apps/api/core");
  vi.mocked(invoke).mockReset();
});

describe("resolveImagePath", () => {
  test("resolves relative path against markdown dir", () => {
    expect(resolveImagePath("note-assets/img.png", "/workspace/notes")).toBe(
      "/workspace/notes/note-assets/img.png",
    );
  });

  test("returns absolute paths unchanged", () => {
    expect(resolveImagePath("/absolute/path.png", "/workspace")).toBe("/absolute/path.png");
  });

  test("returns URLs unchanged", () => {
    expect(resolveImagePath("https://example.com/img.png", "/workspace")).toBe(
      "https://example.com/img.png",
    );
  });

  test("handles subdirectory paths", () => {
    expect(resolveImagePath("sub/dir/img.png", "/workspace/docs")).toBe(
      "/workspace/docs/sub/dir/img.png",
    );
  });

  test("handles angle-bracket image paths with spaces", () => {
    expect(resolveImagePath("<note assets/img file.png>", "/workspace/docs")).toBe(
      "/workspace/docs/note assets/img file.png",
    );
  });

  test("handles percent-encoded image paths with spaces", () => {
    expect(resolveImagePath("note%20assets/img%20file.png", "/workspace/docs")).toBe(
      "/workspace/docs/note assets/img file.png",
    );
  });

  test("formats generated image destinations with spaces", () => {
    expect(formatMarkdownDestination("My Note-assets/image.png")).toBe(
      "<My Note-assets/image.png>",
    );
  });
});

describe("getParentDir", () => {
  test("returns parent directory", () => {
    expect(getParentDir("/workspace/notes/file.md")).toBe("/workspace/notes");
  });

  test("handles root-level files", () => {
    expect(getParentDir("/file.md")).toBe("/");
  });

  test("handles backslashes", () => {
    expect(getParentDir("C:\\Users\\test\\file.md")).toBe("C:/Users/test");
  });
});

describe("saveClipboardImage IPC", () => {
  test("calls correct command", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockedInvoke = vi.mocked(invoke);
    mockedInvoke.mockResolvedValue({
      relative_path: "note-assets/img.png",
      absolute_path: "/ws/note-assets/img.png",
    });

    const { saveClipboardImage } = await import("../src/lib/tauri");
    await saveClipboardImage("/ws/note.md", [1, 2, 3], "png");

    expect(mockedInvoke).toHaveBeenCalledWith("save_clipboard_image", {
      markdownFilePath: "/ws/note.md",
      imageData: [1, 2, 3],
      format: "png",
    });
  });
});

describe("asset upload IPC", () => {
  test("loads and saves masked asset upload settings", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockedInvoke = vi.mocked(invoke);
    const settings = {
      schemaVersion: 2,
      provider: "cloudflare-r2-worker",
      endpoint: "https://upload.example.com",
      apiKey: "********",
      publicBaseUrl: "https://assets.example.com",
      prefix: "images/writer",
      maxBytes: 25 * 1024 * 1024,
    } as const;
    mockedInvoke.mockResolvedValue(settings);

    const { loadAssetUploadSettings, saveAssetUploadSettings } = await import("../src/lib/tauri");
    await expect(loadAssetUploadSettings()).resolves.toBe(settings);
    await saveAssetUploadSettings(settings);

    expect(mockedInvoke).toHaveBeenNthCalledWith(1, "load_asset_upload_settings");
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, "save_asset_upload_settings", { settings });
  });

  test("checks settings and uploads image data through Tauri", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockedInvoke = vi.mocked(invoke);
    mockedInvoke.mockResolvedValueOnce({ ok: true, message: "Connected" }).mockResolvedValueOnce({
      key: "images/writer/2026/07/hash-image.png",
      url: "https://assets.example.com/images/writer/2026/07/hash-image.png",
      size: 3,
      contentType: "image/png",
    });

    const { checkAssetUploadSettings, uploadAssetImage } = await import("../src/lib/tauri");
    const settings = completeSettings();

    await expect(checkAssetUploadSettings(settings)).resolves.toEqual({
      ok: true,
      message: "Connected",
    });
    await expect(
      uploadAssetImage({
        name: "image.png",
        contentType: "image/png",
        imageData: [1, 2, 3],
      }),
    ).resolves.toMatchObject({
      url: "https://assets.example.com/images/writer/2026/07/hash-image.png",
    });

    expect(mockedInvoke).toHaveBeenNthCalledWith(1, "check_asset_upload_settings", { settings });
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, "upload_asset_image", {
      input: {
        name: "image.png",
        contentType: "image/png",
        imageData: [1, 2, 3],
      },
    });
  });
});

describe("resolvePastedImageMarkdown", () => {
  test("uploads remotely when asset settings are complete", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockedInvoke = vi.mocked(invoke);
    mockedInvoke.mockResolvedValueOnce(completeSettings()).mockResolvedValueOnce({
      key: "images/writer/2026/07/hash-pasted.png",
      url: "https://assets.example.com/images/writer/2026/07/hash-pasted.png",
      size: 4,
      contentType: "image/png",
    });

    await expect(
      resolvePastedImageMarkdown(
        new File([new Uint8Array([1, 2, 3, 4])], "Pasted.png", { type: "image/png" }),
        "/ws/note.md",
      ),
    ).resolves.toEqual({
      alt: "Pasted.png",
      destination: "https://assets.example.com/images/writer/2026/07/hash-pasted.png",
    });

    expect(mockedInvoke).toHaveBeenNthCalledWith(1, "load_asset_upload_settings");
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, "upload_asset_image", {
      input: {
        name: "Pasted.png",
        contentType: "image/png",
        imageData: [1, 2, 3, 4],
      },
    });
  });

  test("falls back to local save when asset settings are incomplete", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockedInvoke = vi.mocked(invoke);
    mockedInvoke
      .mockResolvedValueOnce({ ...completeSettings(), endpoint: "", apiKey: "" })
      .mockResolvedValueOnce({
        relative_path: "note-assets/pasted.png",
        absolute_path: "/ws/note-assets/pasted.png",
      });

    await expect(
      resolvePastedImageMarkdown(
        new File([new Uint8Array([1, 2])], "Pasted.png", { type: "image/png" }),
        "/ws/note.md",
      ),
    ).resolves.toEqual({
      alt: "Pasted.png",
      destination: "note-assets/pasted.png",
    });

    expect(mockedInvoke).toHaveBeenNthCalledWith(2, "save_clipboard_image", {
      markdownFilePath: "/ws/note.md",
      imageData: [1, 2],
      format: "png",
    });
  });
});

function completeSettings() {
  return {
    schemaVersion: 2,
    provider: "cloudflare-r2-worker",
    endpoint: "https://upload.example.com",
    apiKey: "key",
    publicBaseUrl: "https://assets.example.com",
    prefix: "images/writer",
    maxBytes: 25 * 1024 * 1024,
  } as const;
}

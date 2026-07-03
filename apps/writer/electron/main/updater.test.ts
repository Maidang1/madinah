import { describe, expect, it, vi } from "vitest";
import {
  createUpdateController,
  type UpdateControllerDependencies,
  type UpdateControllerUpdater,
} from "./updater";

describe("Electron updater controller", () => {
  it("shows a development message without loading the updater", async () => {
    const showMessage = vi.fn(async () => 0);
    const getUpdater = vi.fn();
    const controller = createController({
      isPackaged: () => false,
      getUpdater,
      showMessage,
    });

    await controller.checkForUpdates();

    expect(getUpdater).not.toHaveBeenCalled();
    expect(showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Update checks are available in packaged builds.",
      }),
    );
  });

  it("downloads an available update and installs after confirmation", async () => {
    const updater = createUpdater({
      isUpdateAvailable: true,
      updateInfo: {
        version: "0.1.1",
        releaseName: "Writer 0.1.1",
      },
    });
    const showMessage = vi
      .fn<UpdateControllerDependencies["showMessage"]>()
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    const controller = createController({
      getUpdater: async () => updater,
      showMessage,
    });

    await controller.checkForUpdates();

    expect(updater.autoDownload).toBe(false);
    expect(updater.autoInstallOnAppQuit).toBe(false);
    expect(updater.checkForUpdates).toHaveBeenCalledOnce();
    expect(updater.downloadUpdate).toHaveBeenCalledOnce();
    expect(updater.quitAndInstall).toHaveBeenCalledOnce();
    expect(showMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        message: "Madinah Writer 0.1.1 (Writer 0.1.1) is available.",
      }),
    );
  });

  it("reports the current version when no update is available", async () => {
    const updater = createUpdater({
      isUpdateAvailable: false,
      updateInfo: {
        version: "0.1.0",
      },
    });
    const showMessage = vi.fn(async () => 0);
    const controller = createController({
      getUpdater: async () => updater,
      showMessage,
    });

    await controller.checkForUpdates();

    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    expect(showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Madinah Writer 0.1.0 is up to date.",
      }),
    );
  });

  it("shows an error message when the update check fails", async () => {
    const updater = createUpdater(null);
    updater.checkForUpdates = vi.fn(async () => {
      throw new Error("network unavailable");
    });
    const showMessage = vi.fn(async () => 0);
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const controller = createController({
      getUpdater: async () => updater,
      showMessage,
      logger,
    });

    await controller.checkForUpdates();

    expect(logger.error).toHaveBeenCalledWith(
      "Update check failed",
      expect.any(Error),
    );
    expect(showMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        detail: "network unavailable",
      }),
    );
  });
});

function createController(
  overrides: Partial<UpdateControllerDependencies> = {},
) {
  return createUpdateController({
    productName: "Madinah Writer",
    getVersion: () => "0.1.0",
    isPackaged: () => true,
    showMessage: vi.fn(async () => 0),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  });
}

function createUpdater(
  result: Awaited<ReturnType<UpdateControllerUpdater["checkForUpdates"]>>,
): UpdateControllerUpdater {
  return {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    checkForUpdates: vi.fn(async () => result),
    downloadUpdate: vi.fn(async () => ["/tmp/Madinah Writer.zip"]),
    quitAndInstall: vi.fn(),
  };
}

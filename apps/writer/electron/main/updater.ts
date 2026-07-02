import type { MessageBoxOptions } from "electron";
import type { AppUpdater } from "electron-updater";

export interface UpdateController {
  checkForUpdates(): Promise<void>;
}

export interface UpdateControllerUpdater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates(): Promise<UpdateCheckResult | null>;
  downloadUpdate(): Promise<Array<string>>;
  quitAndInstall(): void;
}

export interface UpdateCheckResult {
  isUpdateAvailable: boolean;
  updateInfo: UpdateInfo;
}

export interface UpdateInfo {
  version: string;
  releaseName?: string | null;
}

export interface UpdateControllerDependencies {
  productName: string;
  getVersion: () => string;
  isPackaged: () => boolean;
  getUpdater?: () => Promise<UpdateControllerUpdater>;
  showMessage: (options: MessageBoxOptions) => Promise<number>;
  logger?: Pick<Console, "error" | "info" | "warn">;
}

type ElectronUpdaterModule = typeof import("electron-updater") & {
  default?: typeof import("electron-updater");
};

export function createUpdateController(
  dependencies: UpdateControllerDependencies,
): UpdateController {
  const logger = dependencies.logger ?? console;
  const getUpdater = dependencies.getUpdater ?? loadElectronAutoUpdater;
  let updaterPromise: Promise<UpdateControllerUpdater> | null = null;
  let activeCheck: Promise<void> | null = null;

  async function checkForUpdates(): Promise<void> {
    if (activeCheck) {
      await dependencies.showMessage({
        type: "info",
        title: dependencies.productName,
        message: `${dependencies.productName} is already checking for updates.`,
        buttons: ["OK"],
      });
      return activeCheck;
    }

    activeCheck = runCheck();
    try {
      await activeCheck;
    } finally {
      activeCheck = null;
    }
  }

  async function runCheck(): Promise<void> {
    if (!dependencies.isPackaged()) {
      await dependencies.showMessage({
        type: "info",
        title: dependencies.productName,
        message: "Update checks are available in packaged builds.",
        detail: `Current development version: ${dependencies.getVersion()}`,
        buttons: ["OK"],
      });
      return;
    }

    try {
      const updater = await getConfiguredUpdater();
      logger.info("Checking for updates");
      const result = await updater.checkForUpdates();

      if (!result?.isUpdateAvailable) {
        await dependencies.showMessage({
          type: "info",
          title: dependencies.productName,
          message: `${dependencies.productName} ${dependencies.getVersion()} is up to date.`,
          buttons: ["OK"],
        });
        return;
      }

      const updateName = formatUpdateName(result.updateInfo);
      const downloadChoice = await dependencies.showMessage({
        type: "info",
        title: dependencies.productName,
        message: `${dependencies.productName} ${updateName} is available.`,
        detail: "Download it now?",
        buttons: ["Download", "Later"],
        defaultId: 0,
        cancelId: 1,
      });
      if (downloadChoice !== 0) return;

      logger.info(`Downloading update ${result.updateInfo.version}`);
      await updater.downloadUpdate();

      const installChoice = await dependencies.showMessage({
        type: "info",
        title: dependencies.productName,
        message: `${dependencies.productName} ${updateName} is ready to install.`,
        detail: "Restart now to finish installing the update.",
        buttons: ["Restart", "Later"],
        defaultId: 0,
        cancelId: 1,
      });
      if (installChoice === 0) {
        updater.quitAndInstall();
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      logger.error("Update check failed", error);
      await dependencies.showMessage({
        type: "error",
        title: dependencies.productName,
        message: `${dependencies.productName} could not check for updates.`,
        detail,
        buttons: ["OK"],
      });
    }
  }

  async function getConfiguredUpdater(): Promise<UpdateControllerUpdater> {
    updaterPromise ??= getUpdater();
    const updater = await updaterPromise;
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    return updater;
  }

  return {
    checkForUpdates,
  };
}

function formatUpdateName(updateInfo: UpdateInfo): string {
  const releaseName = updateInfo.releaseName?.trim();
  if (releaseName) return `${updateInfo.version} (${releaseName})`;
  return updateInfo.version;
}

async function loadElectronAutoUpdater(): Promise<UpdateControllerUpdater> {
  const electronUpdater = (await import(
    "electron-updater"
  )) as ElectronUpdaterModule;
  const updater = electronUpdater.autoUpdater ?? electronUpdater.default?.autoUpdater;
  if (!updater) throw new Error("electron-updater did not expose autoUpdater");
  return updater as AppUpdater;
}

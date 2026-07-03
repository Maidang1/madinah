import chokidar, { type FSWatcher } from "chokidar";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  shell,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
  type MessageBoxOptions,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "electron";
import { access } from "node:fs/promises";
import path from "node:path";
import {
  addRecentFile,
  checkAcpAgent,
  checkAssetUploadSettings,
  createFileTreeDirectory,
  createFileTreeFile,
  deleteDocument,
  duplicateFileTreeFile,
  exportDocumentToBlog,
  getDocument,
  importBlogDir,
  listDocuments,
  listFileTree,
  listRecentFiles,
  loadAssetUploadSettings,
  moveFileTreePathToTrash,
  polishTextWithAcp,
  readMarkdownFile,
  readTrustedPluginBundle,
  renameFileTreePath,
  resolveWorkspace,
  resolveWorkspacePlugins,
  saveAssetUploadSettings,
  saveDocument,
  setWorkspacePluginTrust,
  uploadAssetImage,
  writeMarkdownFile,
  type BackendContext,
} from "./backend";
import { FILE_TREE_CHANGED_EVENT, IPC, WRITER_COMMAND_EVENT } from "../shared/ipc";
import {
  NATIVE_MENU_EDIT_ROLES,
  type NativeMenuEditRole,
} from "../shared/native-menu";
import { createUpdateController } from "./updater";

const APP_ID = "cn.felixwliu.madinah.writer";
const PRODUCT_NAME = "Madinah Writer";
const FILE_TREE_DEBOUNCE_MS = 500;

let mainWindow: BrowserWindow | null = null;
let fileTreeWatcher: FSWatcher | null = null;
let fileTreeTimer: NodeJS.Timeout | null = null;
let isQuitting = false;

app.setName(PRODUCT_NAME);
app.setPath("userData", path.join(app.getPath("appData"), APP_ID));

const context: BackendContext = {
  userDataDir: app.getPath("userData"),
};
const updateController = createUpdateController({
  productName: PRODUCT_NAME,
  getVersion: () => app.getVersion(),
  isPackaged: () => app.isPackaged,
  showMessage: showUpdateMessage,
});

registerIpcHandlers(context);

app.whenReady().then(async () => {
  Menu.setApplicationMenu(buildApplicationMenu());
  mainWindow = await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  void stopFileTreeWatcher();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  void stopFileTreeWatcher();
});

async function createMainWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    title: PRODUCT_NAME,
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 560,
    // Avoid a white flash: keep the window hidden until the renderer painted.
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition: {
      x: 14,
      y: 18,
    },
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.once("ready-to-show", () => {
    if (!window.isDestroyed()) window.show();
  });

  loadRenderer(window);

  return window;
}

function loadRenderer(window: BrowserWindow) {
  const load = process.env.ELECTRON_RENDERER_URL
    ? window.loadURL(process.env.ELECTRON_RENDERER_URL)
    : window.loadFile(rendererIndexPath());

  void load.catch((error: unknown) => {
    if (isQuitting || window.isDestroyed()) return;
    console.error("Failed to load renderer", error);
  });
}

function preloadPath(): string {
  return path.join(app.getAppPath(), "out/preload/index.cjs");
}

function rendererIndexPath(): string {
  return path.join(app.getAppPath(), "out/renderer/index.html");
}

function registerIpcHandlers(backend: BackendContext) {
  ipcMain.handle(IPC.documents.list, () => listDocuments(backend));
  ipcMain.handle(IPC.documents.get, (_event, { id }) => getDocument(backend, id));
  ipcMain.handle(IPC.documents.save, (_event, { document }) =>
    saveDocument(backend, document),
  );
  ipcMain.handle(IPC.documents.delete, (_event, { id }) =>
    deleteDocument(backend, id),
  );

  ipcMain.handle(IPC.files.readMarkdown, (_event, { path }) =>
    readMarkdownFile(path),
  );
  ipcMain.handle(IPC.files.writeMarkdown, (_event, { input }) =>
    writeMarkdownFile(input),
  );

  ipcMain.handle(IPC.fileTree.list, (_event, { root }) => listFileTree(root));
  ipcMain.handle(IPC.fileTree.createFile, (_event, { parentPath, name }) =>
    createFileTreeFile(parentPath, name),
  );
  ipcMain.handle(IPC.fileTree.createDirectory, (_event, { parentPath, name }) =>
    createFileTreeDirectory(parentPath, name),
  );
  ipcMain.handle(IPC.fileTree.renamePath, (_event, { path, name }) =>
    renameFileTreePath(path, name),
  );
  ipcMain.handle(IPC.fileTree.duplicateFile, (_event, { path }) =>
    duplicateFileTreeFile(path),
  );
  ipcMain.handle(IPC.fileTree.moveToTrash, (_event, { workspaceRoot, path }) =>
    moveFileTreePathToTrash(workspaceRoot, path),
  );
  ipcMain.handle(IPC.fileTree.revealPath, async (_event, { path }) => {
    await access(path).catch(() => {
      throw new Error(`Path not found: ${path}`);
    });
    shell.showItemInFolder(path);
  });
  ipcMain.handle(IPC.fileTree.watch, (event, { root }) =>
    startFileTreeWatcher(root, event.sender),
  );
  ipcMain.handle(IPC.fileTree.unwatch, () => stopFileTreeWatcher());

  ipcMain.handle(IPC.recent.list, () => listRecentFiles(backend));
  ipcMain.handle(IPC.recent.add, (_event, { path }) =>
    addRecentFile(backend, path),
  );

  ipcMain.handle(IPC.blog.importDirectory, (_event, { path }) => importBlogDir(path));
  ipcMain.handle(IPC.blog.exportDocument, (_event, { input }) =>
    exportDocumentToBlog(input),
  );

  ipcMain.handle(IPC.plugins.resolveWorkspace, (_event, { path }) =>
    resolveWorkspace(path),
  );
  ipcMain.handle(IPC.plugins.resolveWorkspacePlugins, (_event, { workspaceRoot }) =>
    resolveWorkspacePlugins(backend, workspaceRoot),
  );
  ipcMain.handle(IPC.plugins.readTrustedPluginBundle, (_event, { input }) =>
    readTrustedPluginBundle(backend, input),
  );
  ipcMain.handle(IPC.plugins.setWorkspacePluginTrust, (_event, { input }) =>
    setWorkspacePluginTrust(backend, input),
  );

  ipcMain.handle(IPC.dialog.confirm, (_event, { message, options }) =>
    showConfirmDialog(message, options),
  );
  ipcMain.handle(IPC.dialog.openDirectory, (_event, { options }) =>
    openDirectoryDialog(options),
  );
  ipcMain.handle(IPC.dialog.openMarkdownFile, (_event, { options }) =>
    openMarkdownFileDialog(options),
  );
  ipcMain.handle(IPC.dialog.saveMarkdownFile, (_event, { options }) =>
    saveMarkdownFileDialog(options),
  );
  ipcMain.handle(IPC.dialog.showContextMenu, showContextMenu);

  ipcMain.handle(IPC.aiPolish.polish, (_event, { input }) =>
    polishTextWithAcp(input),
  );
  ipcMain.handle(IPC.aiPolish.check, (_event, { input }) => checkAcpAgent(input));

  ipcMain.handle(IPC.assetUpload.loadSettings, () =>
    loadAssetUploadSettings(backend),
  );
  ipcMain.handle(IPC.assetUpload.saveSettings, (_event, { settings }) =>
    saveAssetUploadSettings(backend, settings),
  );
  ipcMain.handle(IPC.assetUpload.checkSettings, (_event, { settings }) =>
    checkAssetUploadSettings(backend, settings),
  );
  ipcMain.handle(IPC.assetUpload.uploadImage, (_event, { input }) =>
    uploadAssetImage(backend, input),
  );
}

async function showConfirmDialog(
  message: string,
  options?: { title?: string },
): Promise<boolean> {
  const dialogOptions: MessageBoxOptions = {
    type: "warning",
    title: options?.title ?? PRODUCT_NAME,
    message,
    buttons: ["OK", "Cancel"],
    defaultId: 0,
    cancelId: 1,
  };
  const owner = getMainWindow();
  const result = owner
    ? await dialog.showMessageBox(owner, dialogOptions)
    : await dialog.showMessageBox(dialogOptions);
  return result.response === 0;
}

async function showUpdateMessage(options: MessageBoxOptions): Promise<number> {
  const owner = getMainWindow();
  const result = owner
    ? await dialog.showMessageBox(owner, options)
    : await dialog.showMessageBox(options);
  return result.response;
}

async function openDirectoryDialog(options?: {
  title?: string;
}): Promise<string | null> {
  const dialogOptions: OpenDialogOptions = {
    title: options?.title,
    properties: ["openDirectory"],
  };
  const owner = getMainWindow();
  const result = owner
    ? await dialog.showOpenDialog(owner, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  return result.canceled ? null : result.filePaths[0] ?? null;
}

async function openMarkdownFileDialog(options?: {
  title?: string;
}): Promise<string | null> {
  const dialogOptions: OpenDialogOptions = {
    title: options?.title,
    properties: ["openFile"],
    filters: markdownFilters(),
  };
  const owner = getMainWindow();
  const result = owner
    ? await dialog.showOpenDialog(owner, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  return result.canceled ? null : result.filePaths[0] ?? null;
}

async function saveMarkdownFileDialog(options?: {
  title?: string;
  defaultPath?: string;
}): Promise<string | null> {
  const dialogOptions: SaveDialogOptions = {
    title: options?.title,
    defaultPath: options?.defaultPath,
    filters: markdownFilters(),
  };
  const owner = getMainWindow();
  const result = owner
    ? await dialog.showSaveDialog(owner, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);
  return result.canceled ? null : result.filePath ?? null;
}

function markdownFilters() {
  return [
    {
      name: "Markdown",
      extensions: ["md", "mdx", "markdown"],
    },
  ];
}

function showContextMenu(
  event: IpcMainInvokeEvent,
  request: {
    groups: Array<
      Array<
        | {
            id: string;
            label: string;
            disabled?: boolean;
          }
        | {
            role: NativeMenuEditRole;
            label?: string;
            disabled?: boolean;
          }
      >
    >;
    position: { x: number; y: number };
  },
): Promise<string | null> {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || request.groups.length === 0) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const done = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const template = request.groups.flatMap((group, groupIndex) => [
      ...(groupIndex > 0 ? [{ type: "separator" as const }] : []),
      ...group.map((item) => {
        if ("role" in item) {
          return {
            role: item.role,
            label: item.label,
            ...(item.disabled === undefined ? {} : { enabled: !item.disabled }),
          };
        }

        return {
          label: item.label,
          enabled: !item.disabled,
          click: () => done(item.id),
        };
      }),
    ]);

    const menu = Menu.buildFromTemplate(template);
    menu.popup({
      window,
      x: Math.round(request.position.x),
      y: Math.round(request.position.y),
      callback: () => done(null),
    });
  });
}

async function startFileTreeWatcher(
  root: string,
  sender: Electron.WebContents,
): Promise<void> {
  const current = await import("node:fs/promises").then((fs) =>
    fs.stat(root).catch(() => null),
  );
  if (!current?.isDirectory()) throw new Error(`Not a directory: ${root}`);

  await stopFileTreeWatcher();

  fileTreeWatcher = chokidar.watch(root, {
    ignoreInitial: true,
    // Skip heavyweight directories entirely so chokidar never sets up
    // watchers inside them (listVisibleChildren ignores them too). Only
    // segments below the watch root are considered, so a root that itself
    // lives inside a dot-directory keeps working.
    ignored: (filePath) =>
      path
        .relative(root, filePath)
        .split(path.sep)
        .some(
          (segment) =>
            segment === "node_modules" ||
            (segment.startsWith(".") && segment !== "." && segment !== ".."),
        ),
  });
  fileTreeWatcher.on("all", (_eventName, changedPath) => {
    if (!isRelevantFileTreeChange(changedPath)) return;
    if (fileTreeTimer) clearTimeout(fileTreeTimer);
    fileTreeTimer = setTimeout(() => {
      sender.send(FILE_TREE_CHANGED_EVENT);
    }, FILE_TREE_DEBOUNCE_MS);
  });
}

async function stopFileTreeWatcher(): Promise<void> {
  if (fileTreeTimer) {
    clearTimeout(fileTreeTimer);
    fileTreeTimer = null;
  }
  const watcher = fileTreeWatcher;
  fileTreeWatcher = null;
  if (watcher) await watcher.close();
}

function isRelevantFileTreeChange(filePath: string): boolean {
  if (filePath.split(path.sep).includes(".madinah-writer")) return false;
  const extension = path.extname(filePath).slice(1).toLowerCase();
  return !extension || ["md", "mdx", "markdown"].includes(extension);
}

function buildApplicationMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [];

  if (process.platform === "darwin") {
    template.push({
      label: PRODUCT_NAME,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Check for Updates...",
          click: () => {
            void updateController.checkForUpdates();
          },
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    });
  }

  template.push(
    {
      label: "File",
      submenu: [
        commandItem("New Document", "CmdOrCtrl+N", "document.new"),
        commandItem("Open...", "CmdOrCtrl+O", "document.open"),
        { type: "separator" },
        commandItem("Revert", undefined, "document.revert"),
        commandItem("Close", "CmdOrCtrl+W", "document.close"),
      ],
    },
    {
      label: "Edit",
      submenu: [
        nativeEditRoleItem("undo"),
        nativeEditRoleItem("redo"),
        { type: "separator" },
        nativeEditRoleItem("cut"),
        nativeEditRoleItem("copy"),
        nativeEditRoleItem("paste"),
        nativeEditRoleItem("pasteAndMatchStyle"),
        nativeEditRoleItem("delete"),
        { type: "separator" },
        nativeEditRoleItem("selectAll"),
        { type: "separator" },
        commandItem("Bold", "CmdOrCtrl+B", "editor.format.bold"),
        commandItem("Italic", "CmdOrCtrl+I", "editor.format.italic"),
        commandItem("Link", "CmdOrCtrl+K", "editor.format.link"),
        { type: "separator" },
        commandItem("Find", "CmdOrCtrl+F", "document.search"),
      ],
    },
    {
      label: "View",
      submenu: [
        commandItem("Command Palette", "CmdOrCtrl+Shift+P", "view.commandPalette"),
        commandItem("Quick Open", "CmdOrCtrl+P", "view.quickOpen"),
        { type: "separator" },
        commandItem("Write Mode", undefined, "view.write"),
        commandItem("Preview Mode", undefined, "view.preview"),
        commandItem("Source Mode", undefined, "view.source"),
        { type: "separator" },
        commandItem("Toggle Sidebar", "CmdOrCtrl+Alt+S", "view.toggleSidebar"),
        commandItem(
          "Toggle Inspector",
          "CmdOrCtrl+Alt+I",
          "view.toggleInspector",
        ),
        {
          label: "Inspector",
          submenu: [
            commandItem("Outline", undefined, "inspector.showOutline"),
            commandItem("Properties", undefined, "inspector.showProperties"),
            commandItem("Writing Stats", undefined, "inspector.showStats"),
            commandItem("History", undefined, "inspector.showHistory"),
          ],
        },
        { type: "separator" },
        commandItem("Focus Mode", "CmdOrCtrl+Alt+F", "view.focusMode"),
        commandItem("Typewriter Mode", "CmdOrCtrl+Alt+T", "view.typewriterMode"),
      ],
    },
    {
      label: "Go",
      submenu: [commandItem("Outline", "CmdOrCtrl+Alt+O", "go.outline")],
    },
    {
      label: "Window",
      role: "windowMenu",
    },
    {
      label: "Help",
      role: "help",
    },
  );

  return Menu.buildFromTemplate(template);
}

function nativeEditRoleItem(
  role: (typeof NATIVE_MENU_EDIT_ROLES)[number],
): MenuItemConstructorOptions {
  return { role };
}

function commandItem(
  label: string,
  accelerator: string | undefined,
  commandId: string,
): MenuItemConstructorOptions {
  return {
    label,
    accelerator,
    click: (_menuItem, focusedWindow) => {
      const target =
        focusedWindow instanceof BrowserWindow ? focusedWindow : getMainWindow();
      target?.webContents.send(WRITER_COMMAND_EVENT, commandId);
    },
  };
}

function getMainWindow(): BrowserWindow | null {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }
  return mainWindow;
}

import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import { FILE_TREE_CHANGED_EVENT, IPC, WRITER_COMMAND_EVENT } from "../shared/ipc";
import type { MadinahWriterElectronApi } from "../../src/platform/electron-api";

function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  return ipcRenderer.invoke(channel, payload) as Promise<T>;
}

const api: MadinahWriterElectronApi = {
  documents: {
    list: () => invoke(IPC.documents.list),
    get: (id) => invoke(IPC.documents.get, { id }),
    save: (document) => invoke(IPC.documents.save, { document }),
    delete: (id) => invoke(IPC.documents.delete, { id }),
  },
  files: {
    readMarkdown: (path) => invoke(IPC.files.readMarkdown, { path }),
    writeMarkdown: (path, source) =>
      invoke(IPC.files.writeMarkdown, { input: { path, source } }),
  },
  fileTree: {
    list: (root) => invoke(IPC.fileTree.list, { root }),
    createFile: (parentPath, name) =>
      invoke(IPC.fileTree.createFile, { parentPath, name }),
    createDirectory: (parentPath, name) =>
      invoke(IPC.fileTree.createDirectory, { parentPath, name }),
    renamePath: (path, name) =>
      invoke(IPC.fileTree.renamePath, { path, name }),
    duplicateFile: (path) => invoke(IPC.fileTree.duplicateFile, { path }),
    moveToTrash: (workspaceRoot, path) =>
      invoke(IPC.fileTree.moveToTrash, { workspaceRoot, path }),
    revealPath: (path) => invoke(IPC.fileTree.revealPath, { path }),
    watch: (root) => invoke(IPC.fileTree.watch, { root }),
    unwatch: () => invoke(IPC.fileTree.unwatch),
  },
  drafts: {
    read: (path) => invoke(IPC.drafts.read, { path }),
    write: (path, source) => invoke(IPC.drafts.write, { input: { path, source } }),
  },
  recent: {
    list: () => invoke(IPC.recent.list),
    add: (path) => invoke(IPC.recent.add, { path }),
  },
  blog: {
    importDirectory: (path) => invoke(IPC.blog.importDirectory, { path }),
    exportDocument: (input) => invoke(IPC.blog.exportDocument, { input }),
  },
  plugins: {
    resolveWorkspace: (path) => invoke(IPC.plugins.resolveWorkspace, { path }),
    resolveWorkspacePlugins: (workspaceRoot) =>
      invoke(IPC.plugins.resolveWorkspacePlugins, { workspaceRoot }),
    readTrustedPluginBundle: (input) =>
      invoke(IPC.plugins.readTrustedPluginBundle, { input }),
    setWorkspacePluginTrust: (input) =>
      invoke(IPC.plugins.setWorkspacePluginTrust, { input }),
  },
  dialog: {
    confirm: (message, options) =>
      invoke(IPC.dialog.confirm, { message, options }),
    openDirectory: (options) => invoke(IPC.dialog.openDirectory, { options }),
    openMarkdownFile: (options) =>
      invoke(IPC.dialog.openMarkdownFile, { options }),
    saveMarkdownFile: (options) =>
      invoke(IPC.dialog.saveMarkdownFile, { options }),
    showContextMenu: (request) => invoke(IPC.dialog.showContextMenu, request),
  },
  aiPolish: {
    polish: (input) => invoke(IPC.aiPolish.polish, { input }),
    check: (input) => invoke(IPC.aiPolish.check, { input }),
  },
  assetUpload: {
    loadSettings: () => invoke(IPC.assetUpload.loadSettings),
    saveSettings: (settings) =>
      invoke(IPC.assetUpload.saveSettings, { settings }),
    checkSettings: (settings) =>
      invoke(IPC.assetUpload.checkSettings, { settings }),
    uploadImage: (input) => invoke(IPC.assetUpload.uploadImage, { input }),
  },
  onWriterCommand(callback) {
    const listener = (_event: IpcRendererEvent, commandId: unknown) => {
      if (typeof commandId === "string" && commandId) {
        callback(commandId);
      }
    };
    ipcRenderer.on(WRITER_COMMAND_EVENT, listener);
    return () => ipcRenderer.removeListener(WRITER_COMMAND_EVENT, listener);
  },
  onFileTreeChanged(callback) {
    const listener = () => callback();
    ipcRenderer.on(FILE_TREE_CHANGED_EVENT, listener);
    return () => ipcRenderer.removeListener(FILE_TREE_CHANGED_EVENT, listener);
  },
};

contextBridge.exposeInMainWorld("madinahWriter", api);

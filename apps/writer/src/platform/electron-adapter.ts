import type { MarkdownDocument } from "../domain/document";
import type {
  AssetImageUploadInput,
  AssetUploadSettings,
} from "../domain/assets";
import type {
  AcpAgentRuntimeConfig,
  AcpPolishInput,
} from "../domain/ai-polish";
import type {
  TrustedPluginBundleInput,
  WorkspacePluginTrustInput,
} from "../domain/engine";
import type {
  AiPolishAdapter,
  AssetUploadAdapter,
  DocumentStore,
  FileTreeStore,
  PlatformAdapters,
  PluginResolver,
  WindowAdapter,
} from "./ports";
import type { MadinahWriterElectronApi } from "./electron-api";

export function createElectronAdapters(): PlatformAdapters {
  const api = getElectronApi();
  const documentStore = createElectronDocumentStore(api);

  return {
    documentStore,
    fileTreeStore: createElectronFileTreeStore(api),
    fileStore: {
      readMarkdownFile: (path) => api.files.readMarkdown(path),
      writeMarkdownFile: (path, source) => api.files.writeMarkdown(path, source),
    },
    recentStore: {
      list: () => api.recent.list(),
      add: (path) => api.recent.add(path),
    },
    pluginResolver: createElectronPluginResolver(api),
    windowAdapter: createElectronWindowAdapter(api),
    aiPolish: createElectronAiPolishAdapter(api),
    assetUpload: createElectronAssetUploadAdapter(api),
  };
}

export function isElectronRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.madinahWriter);
}

function getElectronApi(): MadinahWriterElectronApi {
  if (!window.madinahWriter) {
    throw new Error("Madinah Writer Electron API is unavailable");
  }
  return window.madinahWriter;
}

function createElectronDocumentStore(
  api: MadinahWriterElectronApi,
): DocumentStore {
  return {
    list: () => api.documents.list(),
    get: (id) => api.documents.get(id),
    save: (document: MarkdownDocument) => api.documents.save(document),
    delete: (id) => api.documents.delete(id),
  };
}

function createElectronFileTreeStore(
  api: MadinahWriterElectronApi,
): FileTreeStore {
  return {
    isAvailable: true,
    listTree: (root) => api.fileTree.list(root),
    readFile: (path) => api.files.readMarkdown(path),
    writeFile: (path, source) => api.files.writeMarkdown(path, source),
    createFile: (parentPath, name) =>
      api.fileTree.createFile(parentPath, name),
    createDirectory: (parentPath, name) =>
      api.fileTree.createDirectory(parentPath, name),
    renamePath: (path, name) => api.fileTree.renamePath(path, name),
    duplicateFile: (path) => api.fileTree.duplicateFile(path),
    moveToTrash: (workspaceRoot, path) =>
      api.fileTree.moveToTrash(workspaceRoot, path),
    revealPath: (path) => api.fileTree.revealPath(path),
    async watchTree(root, onChange) {
      const unsubscribe = api.onFileTreeChanged(onChange);
      await api.fileTree.watch(root);
      return () => {
        unsubscribe();
        void api.fileTree.unwatch().catch(() => {});
      };
    },
  };
}

function createElectronPluginResolver(
  api: MadinahWriterElectronApi,
): PluginResolver {
  return {
    resolveWorkspace: (path) => api.plugins.resolveWorkspace(path),
    resolveWorkspacePlugins: (workspaceRoot) =>
      api.plugins.resolveWorkspacePlugins(workspaceRoot),
    readTrustedPluginBundle: (input: TrustedPluginBundleInput) =>
      api.plugins.readTrustedPluginBundle(input),
    setWorkspacePluginTrust: (input: WorkspacePluginTrustInput) =>
      api.plugins.setWorkspacePluginTrust(input),
  };
}

function createElectronWindowAdapter(
  api: MadinahWriterElectronApi,
): WindowAdapter {
  return {
    confirm: (message, options) => api.dialog.confirm(message, options),
    openDirectory: (options) => api.dialog.openDirectory(options),
    openMarkdownFile: (options) => api.dialog.openMarkdownFile(options),
    saveMarkdownFile: (options) => api.dialog.saveMarkdownFile(options),
    showContextMenu: (request) => api.dialog.showContextMenu(request),
  };
}

function createElectronAiPolishAdapter(
  api: MadinahWriterElectronApi,
): AiPolishAdapter {
  return {
    isAvailable: true,
    polish: (input: AcpPolishInput) => api.aiPolish.polish(input),
    check: (input: AcpAgentRuntimeConfig) => api.aiPolish.check(input),
  };
}

function createElectronAssetUploadAdapter(
  api: MadinahWriterElectronApi,
): AssetUploadAdapter {
  return {
    isAvailable: true,
    loadSettings: () => api.assetUpload.loadSettings(),
    saveSettings: (settings: AssetUploadSettings) =>
      api.assetUpload.saveSettings(settings),
    checkSettings: (settings: AssetUploadSettings) =>
      api.assetUpload.checkSettings(settings),
    uploadImage: (input: AssetImageUploadInput) =>
      api.assetUpload.uploadImage(input),
  };
}

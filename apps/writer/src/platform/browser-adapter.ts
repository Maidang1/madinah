import type { MarkdownDocument } from "../domain/document";
import type {
  AssetImageUploadInput,
  AssetUploadSettings,
} from "../domain/assets";
import { createDefaultAssetUploadSettings } from "../domain/assets";
import type {
  AcpAiActionInput,
  AcpAgentRuntimeConfig,
  AcpPolishInput,
} from "../domain/ai-polish";
import type { WorkspacePluginTrustInput } from "../domain/engine";
import type {
  AiAdapter,
  AiPolishAdapter,
  AssetUploadAdapter,
  BlogStore,
  DocumentStore,
  FileTreeStore,
  FileStore,
  MarkdownFile,
  PlatformAdapters,
  PluginResolver,
  RecentStore,
  WindowAdapter,
} from "./ports";

const DOCUMENTS_KEY = "madinah-writer-documents";
const RECENT_KEY = "madinah-writer-recent";

export function createBrowserAdapters(): PlatformAdapters {
  return {
    documentStore: createBrowserDocumentStore(),
    fileTreeStore: createUnavailableFileTreeStore(),
    fileStore: createBrowserFileStore(),
    recentStore: createBrowserRecentStore(),
    blogStore: createBrowserBlogStore(),
    pluginResolver: createBrowserPluginResolver(),
    windowAdapter: createBrowserWindowAdapter(),
    ai: createBrowserAiAdapter(),
    aiPolish: createBrowserAiPolishAdapter(),
    assetUpload: createBrowserAssetUploadAdapter(),
  };
}

function createUnavailableFileTreeStore(): FileTreeStore {
  const unavailable = () => Promise.reject(new Error("真实目录树需要桌面版"));

  return {
    isAvailable: false,
    listTree: unavailable,
    readFile: (path) => createBrowserFileStore().readMarkdownFile(path),
    writeFile: (path, source) =>
      createBrowserFileStore().writeMarkdownFile(path, source),
    createFile: unavailable,
    createDirectory: unavailable,
    renamePath: unavailable,
    duplicateFile: unavailable,
    moveToTrash: unavailable,
    revealPath: unavailable,
    async watchTree() {
      return () => {};
    },
  };
}

function createBrowserDocumentStore(): DocumentStore {
  return {
    async list() {
      return readJson<MarkdownDocument[]>(DOCUMENTS_KEY, []);
    },
    async get(id) {
      const document = readJson<MarkdownDocument[]>(DOCUMENTS_KEY, []).find(
        (item) => item.id === id,
      );
      if (!document) throw new Error(`Document ${id} not found`);
      return document;
    },
    async save(document) {
      const saved = {
        ...document,
        updatedAt: new Date().toISOString(),
      };
      const documents = readJson<MarkdownDocument[]>(DOCUMENTS_KEY, []);
      const next = documents.some((item) => item.id === saved.id)
        ? documents.map((item) => (item.id === saved.id ? saved : item))
        : [...documents, saved];

      writeJson(DOCUMENTS_KEY, next);
      return saved;
    },
    async delete(id) {
      writeJson(
        DOCUMENTS_KEY,
        readJson<MarkdownDocument[]>(DOCUMENTS_KEY, []).filter(
          (item) => item.id !== id,
        ),
      );
    },
  };
}

function createBrowserFileStore(): FileStore {
  return {
    async readMarkdownFile(path) {
      return {
        path,
        source: window.localStorage.getItem(`madinah-writer-file:${path}`) ?? "",
      };
    },
    async writeMarkdownFile(path, source) {
      window.localStorage.setItem(`madinah-writer-file:${path}`, source);
      return { path, source };
    },
  };
}

function createBrowserRecentStore(): RecentStore {
  return {
    async list() {
      return readJson<MarkdownFile[]>(RECENT_KEY, []);
    },
    async add(path) {
      const current = readJson<MarkdownFile[]>(RECENT_KEY, []);
      const next = [
        { path, source: "" },
        ...current.filter((item) => item.path !== path),
      ].slice(0, 20);
      writeJson(RECENT_KEY, next);
    },
  };
}

function createBrowserBlogStore(): BlogStore {
  const unavailable = () =>
    Promise.reject(new Error("Blog import and export require the desktop app"));

  return {
    isAvailable: false,
    importDirectory: unavailable,
    exportDocument: unavailable,
  };
}

function createBrowserPluginResolver(): PluginResolver {
  return {
    async resolveWorkspace(path) {
      return {
        root: path || "browser://local",
        profile: "gfm",
        plugins: [],
      };
    },
    async resolveWorkspacePlugins() {
      return [];
    },
    async readTrustedPluginBundle() {
      throw new Error("Workspace plugins require the desktop app");
    },
    async setWorkspacePluginTrust(input: WorkspacePluginTrustInput) {
      return {
        ...input,
        updatedAt: new Date().toISOString(),
      };
    },
  };
}

function createBrowserWindowAdapter(): WindowAdapter {
  return {
    async confirm(message) {
      return window.confirm(message);
    },
    async openDirectory() {
      return null;
    },
    async openMarkdownFile() {
      return window.prompt("Markdown file path");
    },
    async saveMarkdownFile(options) {
      return window.prompt("Save Markdown file path", options?.defaultPath ?? "");
    },
    async showContextMenu() {
      return null;
    },
  };
}

function createBrowserAiPolishAdapter(): AiPolishAdapter {
  const unavailable = () =>
    Promise.reject(new Error("ACP polishing requires the desktop app"));

  return {
    isAvailable: false,
    polish: (_input: AcpPolishInput) => unavailable(),
    async check(_input: AcpAgentRuntimeConfig) {
      return {
        ok: false,
        message: "ACP polishing requires the desktop app",
      };
    },
  };
}

function createBrowserAiAdapter(): AiAdapter {
  const unavailable = () =>
    Promise.reject(new Error("ACP AI actions require the desktop app"));

  return {
    isAvailable: false,
    runAction: (_input: AcpAiActionInput) => unavailable(),
    async check(_input: AcpAgentRuntimeConfig) {
      return {
        ok: false,
        message: "ACP AI actions require the desktop app",
      };
    },
  };
}

function createBrowserAssetUploadAdapter(): AssetUploadAdapter {
  const unavailable = () =>
    Promise.reject(new Error("Asset uploads require the desktop app"));

  return {
    isAvailable: false,
    async loadSettings() {
      return createDefaultAssetUploadSettings();
    },
    async saveSettings(settings: AssetUploadSettings) {
      return settings;
    },
    async checkSettings(_settings: AssetUploadSettings) {
      return {
        ok: false,
        message: "Asset uploads require the desktop app",
      };
    },
    uploadImage(_input: AssetImageUploadInput) {
      return unavailable();
    },
  };
}

function readJson<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

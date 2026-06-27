import { invoke } from "@tauri-apps/api/core";
import { confirm, open, save } from "@tauri-apps/plugin-dialog";
import type { MarkdownDocument } from "../domain/document";
import type {
  AcpAgentRuntimeConfig,
  AcpPolishInput,
} from "../domain/ai-polish";
import type {
  ResolvedPlugin,
  TrustedPluginBundle,
  TrustedPluginBundleInput,
  WorkspaceInfo,
  WorkspacePluginTrustInput,
  WorkspacePluginTrustRecord,
} from "../domain/engine";
import type {
  AiPolishAdapter,
  DocumentStore,
  FileTreeNode,
  FileTreeStore,
  PlatformAdapters,
  PluginResolver,
  WindowAdapter,
} from "./ports";

export function createTauriAdapters(): PlatformAdapters {
  const documentStore = createTauriDocumentStore();

  return {
    documentStore,
    fileTreeStore: createTauriFileTreeStore(),
    fileStore: {
      readMarkdownFile: (path) => invoke("read_markdown_file", { path }),
      writeMarkdownFile: (path, source) =>
        invoke("write_markdown_file", { input: { path, source } }),
    },
    draftStore: {
      read: (path) => invoke("read_draft", { path }),
      write: (path, source) => invoke("write_draft", { input: { path, source } }),
    },
    recentStore: {
      list: () => invoke("list_recent_files"),
      add: (path) => invoke("add_recent_file", { path }),
    },
    pluginResolver: createTauriPluginResolver(),
    windowAdapter: createTauriWindowAdapter(),
    aiPolish: createTauriAiPolishAdapter(),
  };
}

function createTauriFileTreeStore(): FileTreeStore {
  return {
    isAvailable: true,
    listTree: (root) => invoke<FileTreeNode[]>("list_file_tree", { root }),
    readFile: (path) => invoke("read_markdown_file", { path }),
    writeFile: (path, source) =>
      invoke("write_markdown_file", { input: { path, source } }),
    createFile: (parentPath, name) =>
      invoke("create_file_tree_file", { parentPath, name }),
    createDirectory: (parentPath, name) =>
      invoke<FileTreeNode>("create_file_tree_directory", { parentPath, name }),
    renamePath: (path, name) =>
      invoke<FileTreeNode>("rename_file_tree_path", { path, name }),
    duplicateFile: (path) => invoke("duplicate_file_tree_file", { path }),
    moveToTrash: (workspaceRoot, path) =>
      invoke<string>("move_file_tree_path_to_trash", { workspaceRoot, path }),
    revealPath: (path) => invoke("reveal_file_tree_path", { path }),
    async watchTree(root, onChange) {
      const { listen } = await import("@tauri-apps/api/event");
      const unlisten = await listen("file-tree-changed", () => onChange());
      await invoke("watch_file_tree", { root });
      return () => {
        unlisten();
        void invoke("unwatch_file_tree").catch(() => {});
      };
    },
  };
}

function createTauriDocumentStore(): DocumentStore {
  return {
    list: () => invoke<MarkdownDocument[]>("list_documents"),
    get: (id) => invoke<MarkdownDocument>("get_document", { id }),
    save: (document) => invoke<MarkdownDocument>("save_document", { document }),
    delete: (id) => invoke("delete_document", { id }),
  };
}

function createTauriPluginResolver(): PluginResolver {
  return {
    resolveWorkspace: (path) =>
      invoke<WorkspaceInfo>("resolve_workspace", { path }),
    resolveWorkspacePlugins: (workspaceRoot) =>
      invoke<ResolvedPlugin[]>("resolve_workspace_plugins", { workspaceRoot }),
    readTrustedPluginBundle: (input: TrustedPluginBundleInput) =>
      invoke<TrustedPluginBundle>("read_trusted_plugin_bundle", { input }),
    setWorkspacePluginTrust: (input: WorkspacePluginTrustInput) =>
      invoke<WorkspacePluginTrustRecord>("set_workspace_plugin_trust", { input }),
  };
}

function createTauriWindowAdapter(): WindowAdapter {
  return {
    confirm: (message, options) =>
      confirm(message, {
        title: options?.title,
      }),
    async openDirectory(options) {
      const selected = await open({
        directory: true,
        multiple: false,
        title: options?.title,
      });

      return typeof selected === "string" ? selected : null;
    },
    async openMarkdownFile(options) {
      const selected = await open({
        directory: false,
        multiple: false,
        title: options?.title,
        filters: [
          {
            name: "Markdown",
            extensions: ["md", "mdx", "markdown"],
          },
        ],
      });

      return typeof selected === "string" ? selected : null;
    },
    async saveMarkdownFile(options) {
      const selected = await save({
        title: options?.title,
        defaultPath: options?.defaultPath,
        filters: [
          {
            name: "Markdown",
            extensions: ["md", "mdx", "markdown"],
          },
        ],
      });

      return typeof selected === "string" ? selected : null;
    },
  };
}

function createTauriAiPolishAdapter(): AiPolishAdapter {
  return {
    isAvailable: true,
    polish: (input: AcpPolishInput) => invoke("polish_text_with_acp", { input }),
    check: (input: AcpAgentRuntimeConfig) => invoke("check_acp_agent", { input }),
  };
}

import type {
  AcpAgentCheckResult,
  AcpAgentRuntimeConfig,
  AcpPolishInput,
  AcpPolishResult,
} from "../domain/ai-polish";
import type {
  AssetImageUploadInput,
  AssetImageUploadResult,
  AssetUploadCheckResult,
  AssetUploadSettings,
} from "../domain/assets";
import type { MarkdownDocument } from "../domain/document";
import type {
  ResolvedPlugin,
  TrustedPluginBundle,
  TrustedPluginBundleInput,
  WorkspaceInfo,
  WorkspacePluginTrustInput,
  WorkspacePluginTrustRecord,
} from "../domain/engine";
import type { NativeMenuEditRole } from "../../electron/shared/native-menu";
import type { FileTreeNode, MarkdownFile } from "./ports";

export type ElectronContextMenuItem<TAction extends string = string> =
  | {
      id: TAction;
      label: string;
      disabled?: boolean;
    }
  | {
      role: NativeMenuEditRole;
      label?: string;
      disabled?: boolean;
    };

export interface ElectronContextMenuGroup<TAction extends string = string> {
  id: TAction;
  label: string;
  disabled?: boolean;
}

export interface ElectronContextMenuRequest<TAction extends string = string> {
  groups: ElectronContextMenuItem<TAction>[][];
  position: {
    x: number;
    y: number;
  };
}

export interface MadinahWriterElectronApi {
  documents: {
    list(): Promise<MarkdownDocument[]>;
    get(id: string): Promise<MarkdownDocument>;
    save(document: MarkdownDocument): Promise<MarkdownDocument>;
    delete(id: string): Promise<void>;
  };
  files: {
    readMarkdown(path: string): Promise<MarkdownFile>;
    writeMarkdown(path: string, source: string): Promise<MarkdownFile>;
  };
  fileTree: {
    list(root: string): Promise<FileTreeNode[]>;
    createFile(parentPath: string, name: string): Promise<MarkdownFile>;
    createDirectory(parentPath: string, name: string): Promise<FileTreeNode>;
    renamePath(path: string, name: string): Promise<FileTreeNode>;
    duplicateFile(path: string): Promise<MarkdownFile>;
    moveToTrash(workspaceRoot: string, path: string): Promise<string>;
    revealPath(path: string): Promise<void>;
    watch(root: string): Promise<void>;
    unwatch(): Promise<void>;
  };
  recent: {
    list(): Promise<MarkdownFile[]>;
    add(path: string): Promise<void>;
  };
  blog: {
    importDirectory(
      path: string,
    ): Promise<Array<{ slug: string; path: string; source: string }>>;
    exportDocument(input: {
      blogDir: string;
      slug: string;
      source: string;
      overwrite: boolean;
    }): Promise<{ path: string }>;
  };
  plugins: {
    resolveWorkspace(path: string): Promise<WorkspaceInfo>;
    resolveWorkspacePlugins(workspaceRoot: string): Promise<ResolvedPlugin[]>;
    readTrustedPluginBundle(
      input: TrustedPluginBundleInput,
    ): Promise<TrustedPluginBundle>;
    setWorkspacePluginTrust(
      input: WorkspacePluginTrustInput,
    ): Promise<WorkspacePluginTrustRecord>;
  };
  dialog: {
    confirm(message: string, options?: { title?: string }): Promise<boolean>;
    openDirectory(options?: { title?: string }): Promise<string | null>;
    openMarkdownFile(options?: { title?: string }): Promise<string | null>;
    saveMarkdownFile(options?: {
      title?: string;
      defaultPath?: string;
    }): Promise<string | null>;
    showContextMenu<TAction extends string>(
      request: ElectronContextMenuRequest<TAction>,
    ): Promise<TAction | null>;
  };
  aiPolish: {
    polish(input: AcpPolishInput): Promise<AcpPolishResult>;
    check(input: AcpAgentRuntimeConfig): Promise<AcpAgentCheckResult>;
  };
  assetUpload: {
    loadSettings(): Promise<AssetUploadSettings>;
    saveSettings(settings: AssetUploadSettings): Promise<AssetUploadSettings>;
    checkSettings(
      settings: AssetUploadSettings,
    ): Promise<AssetUploadCheckResult>;
    uploadImage(input: AssetImageUploadInput): Promise<AssetImageUploadResult>;
  };
  onWriterCommand(callback: (commandId: string) => void): () => void;
  onFileTreeChanged(callback: () => void): () => void;
}

declare global {
  interface Window {
    madinahWriter?: MadinahWriterElectronApi;
  }
}

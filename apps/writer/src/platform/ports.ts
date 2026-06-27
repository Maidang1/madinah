import type { MarkdownDocument } from "../domain/document";
import type {
  AcpAgentCheckResult,
  AcpAgentRuntimeConfig,
  AcpPolishInput,
  AcpPolishResult,
} from "../domain/ai-polish";
import type {
  ResolvedPlugin,
  TrustedPluginBundle,
  TrustedPluginBundleInput,
  WorkspaceInfo,
  WorkspacePluginTrustInput,
  WorkspacePluginTrustRecord,
} from "../domain/engine";

export interface MarkdownFile {
  path: string;
  source: string;
}

export type FileTreeNodeKind = "directory" | "file";

export interface FileTreeNode {
  path: string;
  name: string;
  kind: FileTreeNodeKind;
  childrenCount: number;
  children: FileTreeNode[];
}

export interface FileStore {
  readMarkdownFile(path: string): Promise<MarkdownFile>;
  writeMarkdownFile(path: string, source: string): Promise<MarkdownFile>;
}

export interface FileTreeStore {
  isAvailable: boolean;
  listTree(root: string): Promise<FileTreeNode[]>;
  readFile(path: string): Promise<MarkdownFile>;
  writeFile(path: string, source: string): Promise<MarkdownFile>;
  createFile(parentPath: string, name: string): Promise<MarkdownFile>;
  createDirectory(parentPath: string, name: string): Promise<FileTreeNode>;
  renamePath(path: string, name: string): Promise<FileTreeNode>;
  duplicateFile(path: string): Promise<MarkdownFile>;
  moveToTrash(workspaceRoot: string, path: string): Promise<string>;
  revealPath(path: string): Promise<void>;
  watchTree(root: string, onChange: () => void): Promise<() => void>;
}

export interface DocumentStore {
  list(): Promise<MarkdownDocument[]>;
  get(id: string): Promise<MarkdownDocument>;
  save(document: MarkdownDocument): Promise<MarkdownDocument>;
  delete(id: string): Promise<void>;
}

export interface DraftStore {
  read(path: string): Promise<MarkdownFile | null>;
  write(path: string, source: string): Promise<MarkdownFile>;
}

export interface RecentStore {
  list(): Promise<MarkdownFile[]>;
  add(path: string): Promise<void>;
}

export interface PluginResolver {
  resolveWorkspace(path: string): Promise<WorkspaceInfo>;
  resolveWorkspacePlugins(workspaceRoot: string): Promise<ResolvedPlugin[]>;
  readTrustedPluginBundle(
    input: TrustedPluginBundleInput,
  ): Promise<TrustedPluginBundle>;
  setWorkspacePluginTrust(
    input: WorkspacePluginTrustInput,
  ): Promise<WorkspacePluginTrustRecord>;
}

export interface WindowAdapter {
  confirm(message: string, options?: { title?: string }): Promise<boolean>;
  openDirectory(options?: { title?: string }): Promise<string | null>;
  openMarkdownFile(options?: { title?: string }): Promise<string | null>;
  saveMarkdownFile(options?: {
    title?: string;
    defaultPath?: string;
  }): Promise<string | null>;
}

export interface AiPolishAdapter {
  isAvailable: boolean;
  polish(input: AcpPolishInput): Promise<AcpPolishResult>;
  check(input: AcpAgentRuntimeConfig): Promise<AcpAgentCheckResult>;
}

export interface PlatformAdapters {
  documentStore: DocumentStore;
  fileTreeStore: FileTreeStore;
  fileStore: FileStore;
  draftStore: DraftStore;
  recentStore: RecentStore;
  pluginResolver: PluginResolver;
  windowAdapter: WindowAdapter;
  aiPolish: AiPolishAdapter;
}

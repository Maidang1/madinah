import {
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import * as acp from "@agentclientprotocol/sdk";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import {
  chmod,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { parse as parseShellCommand } from "shell-quote";
import type {
  AcpAgentCheckResult,
  AcpAgentRuntimeConfig,
  AcpEnvVar,
  AcpPolishInput,
  AcpPolishResult,
} from "../../src/domain/ai-polish";
import type {
  AssetImageUploadInput,
  AssetImageUploadResult,
  AssetUploadCheckResult,
  AssetUploadSettings,
} from "../../src/domain/assets";
import type { MarkdownDocument } from "../../src/domain/document";
import type {
  ResolvedPlugin,
  TrustedPluginBundle,
  TrustedPluginBundleInput,
  WorkspaceInfo,
  WorkspacePluginTrustInput,
  WorkspacePluginTrustRecord,
} from "../../src/domain/engine";
import type { FileTreeNode, MarkdownFile } from "../../src/platform/ports";

export interface BackendContext {
  userDataDir: string;
}

export interface WriteMarkdownFileInput {
  path: string;
  source: string;
}

interface WorkspaceConfig {
  schemaVersion: number;
  profile: string;
  plugins: string[];
}

interface PackageManifest {
  name?: string;
  version?: string;
  madinahWriter?: {
    apiVersion: number;
    entry: string;
    capabilities?: string[];
  };
}

const CONFIG_DIR = ".madinah-writer";
const CONFIG_FILE = "config.json";
const SECRET_PLACEHOLDER = "********";
const DEFAULT_BUCKET = "madinah-assets";
const DEFAULT_PUBLIC_BASE_URL = "https://assets.felixwliu.cn";
const DEFAULT_PREFIX = "images/writer";
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const MAX_ALLOWED_BYTES = 500 * 1024 * 1024;
const CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable";
const ACP_DEFAULT_TIMEOUT_SECONDS = 120;

export async function listDocuments(
  context: BackendContext,
): Promise<MarkdownDocument[]> {
  const dir = documentsDir(context);
  await ensureDir(dir);

  const entries = await readdir(dir, { withFileTypes: true });
  const documents = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && path.extname(entry.name) === ".json")
      .map(async (entry) =>
        readJsonFile<MarkdownDocument>(path.join(dir, entry.name)),
      ),
  );

  return documents.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export async function getDocument(
  context: BackendContext,
  id: string,
): Promise<MarkdownDocument> {
  return readJsonFile<MarkdownDocument>(documentPath(context, id));
}

export async function saveDocument(
  context: BackendContext,
  document: MarkdownDocument,
): Promise<MarkdownDocument> {
  const filePath = documentPath(context, document.id);
  await ensureDir(path.dirname(filePath));
  await writeJsonFile(filePath, document);
  return document;
}

export async function deleteDocument(
  context: BackendContext,
  id: string,
): Promise<void> {
  await rm(documentPath(context, id), { force: true });
}

export async function readMarkdownFile(filePath: string): Promise<MarkdownFile> {
  return {
    path: filePath,
    source: await readFile(filePath, "utf8"),
  };
}

export async function writeMarkdownFile(
  input: WriteMarkdownFileInput,
): Promise<MarkdownFile> {
  await ensureDir(path.dirname(input.path));
  await writeFile(input.path, input.source, "utf8");
  return {
    path: input.path,
    source: input.source,
  };
}

export async function listFileTree(root: string): Promise<FileTreeNode[]> {
  const rootStat = await stat(root).catch(() => null);
  if (!rootStat) throw new Error(`Directory not found: ${root}`);
  if (!rootStat.isDirectory()) throw new Error(`Not a directory: ${root}`);
  return listVisibleChildren(root);
}

export async function createFileTreeFile(
  parentPath: string,
  name: string,
): Promise<MarkdownFile> {
  const parentStat = await stat(parentPath).catch(() => null);
  if (!parentStat?.isDirectory()) throw new Error(`Not a directory: ${parentPath}`);

  const safeName = validateChildName(name);
  if (!isMarkdownPath(safeName)) {
    throw new Error("Only Markdown files can be created");
  }

  const filePath = path.join(parentPath, safeName);
  if (existsSync(filePath)) throw new Error(`${filePath} already exists`);

  const stem = path.basename(filePath, path.extname(filePath)).trim() || "Untitled";
  const source = `# ${stem}\n\n`;
  await writeFile(filePath, source, "utf8");
  return { path: filePath, source };
}

export async function createFileTreeDirectory(
  parentPath: string,
  name: string,
): Promise<FileTreeNode> {
  const parentStat = await stat(parentPath).catch(() => null);
  if (!parentStat?.isDirectory()) throw new Error(`Not a directory: ${parentPath}`);

  const safeName = validateChildName(name);
  const dirPath = path.join(parentPath, safeName);
  if (existsSync(dirPath)) throw new Error(`${dirPath} already exists`);

  await mkdir(dirPath);
  return entryForPath(dirPath);
}

export async function renameFileTreePath(
  filePath: string,
  name: string,
): Promise<FileTreeNode> {
  const currentStat = await stat(filePath).catch(() => null);
  if (!currentStat) throw new Error(`Path not found: ${filePath}`);

  const safeName = validateChildName(name);
  if (currentStat.isFile() && !isMarkdownPath(safeName)) {
    throw new Error("Only Markdown files can be renamed in the file tree");
  }

  const parent = path.dirname(filePath);
  if (!parent || parent === filePath) {
    throw new Error(`Cannot rename root path: ${filePath}`);
  }

  const target = path.join(parent, safeName);
  if (existsSync(target)) throw new Error(`${target} already exists`);

  await rename(filePath, target);
  return entryForPath(target);
}

export async function duplicateFileTreeFile(
  filePath: string,
): Promise<MarkdownFile> {
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat?.isFile() || !isMarkdownPath(filePath)) {
    throw new Error(`Not a Markdown file: ${filePath}`);
  }

  const source = await readFile(filePath, "utf8");
  const target = nextDuplicatePath(filePath);
  await writeFile(target, source, "utf8");
  return {
    path: target,
    source,
  };
}

export async function moveFileTreePathToTrash(
  workspaceRoot: string,
  filePath: string,
): Promise<string> {
  const rootStat = await stat(workspaceRoot).catch(() => null);
  if (!rootStat?.isDirectory()) {
    throw new Error(`Workspace not found: ${workspaceRoot}`);
  }
  if (!existsSync(filePath)) throw new Error(`Path not found: ${filePath}`);

  const canonicalRoot = await realPath(workspaceRoot);
  const canonicalPath = await realPath(filePath);
  if (!isPathInside(canonicalPath, canonicalRoot)) {
    throw new Error("Path is outside the workspace");
  }

  const trashDir = path.join(workspaceRoot, CONFIG_DIR, "trash");
  await ensureDir(trashDir);

  const originalName = path.basename(filePath);
  if (!originalName) throw new Error("Invalid path name");

  const target = uniquePath(path.join(trashDir, `${Date.now()}-${originalName}`));
  await rename(filePath, target);
  return target;
}

export async function readDraft(
  context: BackendContext,
  filePath: string,
): Promise<MarkdownFile | null> {
  const draft = draftPath(context, filePath);
  if (!existsSync(draft)) return null;
  return {
    path: filePath,
    source: await readFile(draft, "utf8"),
  };
}

export async function writeDraft(
  context: BackendContext,
  input: WriteMarkdownFileInput,
): Promise<MarkdownFile> {
  const draft = draftPath(context, input.path);
  await ensureDir(path.dirname(draft));
  await writeFile(draft, input.source, "utf8");
  return {
    path: input.path,
    source: input.source,
  };
}

export async function listRecentFiles(
  context: BackendContext,
): Promise<MarkdownFile[]> {
  const filePath = recentPath(context);
  if (!existsSync(filePath)) return [];
  return readJsonFile<MarkdownFile[]>(filePath);
}

export async function addRecentFile(
  context: BackendContext,
  filePath: string,
): Promise<void> {
  const recent = recentPath(context);
  await ensureDir(path.dirname(recent));

  const current = await listRecentFiles(context);
  const next = [
    { path: filePath, source: "" },
    ...current.filter((item) => item.path !== filePath),
  ].slice(0, 20);

  await writeJsonFile(recent, next);
}

export async function importBlogDir(
  inputPath: string,
): Promise<Array<{ slug: string; path: string; source: string }>> {
  const blogsDir = resolveBlogsDir(inputPath);
  if (!existsSync(blogsDir)) {
    throw new Error(`Blog directory not found: ${blogsDir}`);
  }

  const files = await collectFiles(blogsDir);
  const imported = await Promise.all(
    files
      .filter((filePath) => isMdxBlogPath(filePath))
      .map(async (filePath) => {
        const relative = path.relative(blogsDir, filePath);
        const slug = stripExtension(relative).split(path.sep).join("/");
        return {
          slug,
          path: filePath,
          source: await readFile(filePath, "utf8"),
        };
      }),
  );

  return imported.sort((left, right) => left.slug.localeCompare(right.slug));
}

export async function exportDocumentToBlog(input: {
  blogDir: string;
  slug: string;
  source: string;
  overwrite: boolean;
}): Promise<{ path: string }> {
  const blogsDir = resolveBlogsDir(input.blogDir);
  await ensureDir(blogsDir);

  const outputPath = exportPathForSlug(blogsDir, input.slug);
  if (existsSync(outputPath) && !input.overwrite) {
    throw new Error(`${outputPath} already exists`);
  }

  await ensureDir(path.dirname(outputPath));
  await writeFile(outputPath, input.source, "utf8");
  return { path: outputPath };
}

export function resolveBlogsDir(inputPath: string): string {
  if (path.basename(inputPath) === "blogs") return inputPath;

  const nested = path.join(inputPath, "src", "blogs");
  if (existsSync(nested) || !existsSync(path.join(inputPath, "src"))) {
    return nested;
  }

  return inputPath;
}

export function exportPathForSlug(blogsDir: string, slug: string): string {
  const trimmed = slug.trim().replace(/^\/+|\/+$/gu, "");
  if (!trimmed || trimmed.includes("..")) {
    throw new Error("Invalid slug");
  }
  return path.join(blogsDir, `${trimmed}.mdx`);
}

export async function resolveWorkspace(
  inputPath: string,
): Promise<WorkspaceInfo> {
  const start = workspaceSearchStart(inputPath);
  const ancestors = pathAncestors(start);

  for (const ancestor of ancestors) {
    const configPath = workspaceConfigPath(ancestor);
    if (existsSync(configPath)) {
      return workspaceInfoFromConfig(ancestor, configPath);
    }
  }

  for (const ancestor of ancestors) {
    if (existsSync(path.join(ancestor, "package.json"))) {
      return defaultWorkspaceInfo(ancestor);
    }
  }

  return defaultWorkspaceInfo(start);
}

export async function resolveWorkspacePlugins(
  context: BackendContext,
  workspaceRoot: string,
): Promise<ResolvedPlugin[]> {
  return resolveWorkspacePluginsFromRootWithTrust(
    workspaceRoot,
    pluginTrustPath(context),
  );
}

export async function resolveWorkspacePluginsFromRootWithTrust(
  workspaceRoot: string,
  trustPath?: string | null,
): Promise<ResolvedPlugin[]> {
  const config = await readWorkspaceConfig(workspaceRoot);
  return Promise.all(
    config.plugins.map((spec) => resolvePlugin(workspaceRoot, spec, trustPath)),
  );
}

export async function readTrustedPluginBundle(
  context: BackendContext,
  input: TrustedPluginBundleInput,
): Promise<TrustedPluginBundle> {
  return readTrustedPluginBundleFromFile(pluginTrustPath(context), input);
}

export async function readTrustedPluginBundleFromFile(
  trustPath: string,
  input: TrustedPluginBundleInput,
): Promise<TrustedPluginBundle> {
  const trusted = await isTrustedPlugin(
    trustPath,
    input.workspaceRoot,
    input.packageId,
    input.version,
    input.bundleHash,
  );
  if (!trusted) throw new Error(`Plugin ${input.packageId} is not trusted`);

  const code = await readFile(input.entryPath, "utf8");
  const hash = hashBytes(Buffer.from(code));
  if (hash !== input.bundleHash) {
    throw new Error(`Plugin bundle hash changed: ${input.packageId}`);
  }

  return { code, hash };
}

export async function setWorkspacePluginTrust(
  context: BackendContext,
  input: WorkspacePluginTrustInput,
): Promise<WorkspacePluginTrustRecord> {
  return setPluginTrustInFile(pluginTrustPath(context), input);
}

export async function setPluginTrustInFile(
  trustPath: string,
  input: WorkspacePluginTrustInput,
): Promise<WorkspacePluginTrustRecord> {
  await ensureDir(path.dirname(trustPath));

  const records = await readTrustRecords(trustPath);
  const record = {
    ...input,
    updatedAt: unixTimestampString(),
  };

  const next = records
    .filter(
      (item) =>
        item.workspaceRoot !== record.workspaceRoot ||
        item.packageId !== record.packageId ||
        item.version !== record.version,
    )
    .concat(record);

  await writeJsonFile(trustPath, next);
  return record;
}

export async function loadAssetUploadSettings(
  context: BackendContext,
): Promise<AssetUploadSettings> {
  return loadAssetUploadSettingsFromFile(assetUploadSettingsPath(context));
}

export async function saveAssetUploadSettings(
  context: BackendContext,
  settings: AssetUploadSettings,
): Promise<AssetUploadSettings> {
  return saveAssetUploadSettingsToFile(assetUploadSettingsPath(context), settings);
}

export async function checkAssetUploadSettings(
  context: BackendContext,
  settings: AssetUploadSettings,
): Promise<AssetUploadCheckResult> {
  const current = await readStoredAssetUploadSettings(context).catch(() =>
    defaultAssetUploadSettings(),
  );
  const next = normalizeAssetUploadSettings(
    preservePlaceholderSecret(settings, current),
  );

  try {
    validateCompleteAssetUploadSettings(next);
    await r2Client(next).send(new HeadBucketCommand({ Bucket: next.bucket }));
    return { ok: true, message: "Connected" };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function uploadAssetImage(
  context: BackendContext,
  input: AssetImageUploadInput,
): Promise<AssetImageUploadResult> {
  const settings = await readStoredAssetUploadSettings(context);
  validateCompleteAssetUploadSettings(settings);

  const bytes = Buffer.from(input.dataBase64.trim(), "base64");
  validateImagePayload(input, bytes.length, settings.maxBytes);

  const now = new Date();
  const key = buildAssetObjectKey(
    settings.prefix,
    input.name,
    input.contentType,
    bytes,
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
  );

  await r2Client(settings).send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: bytes,
      ContentType: input.contentType,
      CacheControl: CACHE_CONTROL_IMMUTABLE,
    }),
  );

  return {
    key,
    url: publicAssetUrl(settings.publicBaseUrl, key),
    size: input.size,
    contentType: input.contentType,
  };
}

export function defaultAssetUploadSettings(): AssetUploadSettings {
  return {
    accountId: "",
    bucket: DEFAULT_BUCKET,
    accessKeyId: "",
    secretAccessKey: "",
    publicBaseUrl: DEFAULT_PUBLIC_BASE_URL,
    prefix: DEFAULT_PREFIX,
    maxBytes: DEFAULT_MAX_BYTES,
  };
}

export async function loadAssetUploadSettingsFromFile(
  settingsPath: string,
): Promise<AssetUploadSettings> {
  return maskAssetUploadSecret(await readStoredAssetUploadSettingsFromPath(settingsPath));
}

export async function saveAssetUploadSettingsToFile(
  settingsPath: string,
  settings: AssetUploadSettings,
): Promise<AssetUploadSettings> {
  const current = await readStoredAssetUploadSettingsFromPath(settingsPath).catch(() =>
    defaultAssetUploadSettings(),
  );
  const next = normalizeAssetUploadSettings(
    preservePlaceholderSecret(settings, current),
  );
  validateSafeAssetUploadSettingsShape(next);

  await ensureDir(path.dirname(settingsPath));
  await writeJsonFile(settingsPath, next);
  await chmod(settingsPath, 0o600).catch(() => {});
  return maskAssetUploadSecret(next);
}

export function normalizeAssetUploadSettings(
  settings: AssetUploadSettings,
): AssetUploadSettings {
  const fallback = defaultAssetUploadSettings();
  return {
    accountId: settings.accountId.trim(),
    bucket: fallbackIfEmpty(settings.bucket.trim(), fallback.bucket),
    accessKeyId: settings.accessKeyId.trim(),
    secretAccessKey: settings.secretAccessKey.trim(),
    publicBaseUrl: fallbackIfEmpty(
      settings.publicBaseUrl.trim().replace(/\/+$/u, ""),
      fallback.publicBaseUrl,
    ),
    prefix: fallbackIfEmpty(
      settings.prefix.trim().replace(/\\/gu, "/").replace(/^\/+|\/+$/gu, ""),
      fallback.prefix,
    ),
    maxBytes: Math.max(
      1024,
      Math.min(MAX_ALLOWED_BYTES, Math.round(settings.maxBytes)),
    ),
  };
}

export function preservePlaceholderSecret(
  settings: AssetUploadSettings,
  current: AssetUploadSettings,
): AssetUploadSettings {
  if (settings.secretAccessKey.trim() === SECRET_PLACEHOLDER) {
    return {
      ...settings,
      secretAccessKey: current.secretAccessKey,
    };
  }

  return settings;
}

export function maskAssetUploadSecret(
  settings: AssetUploadSettings,
): AssetUploadSettings {
  return {
    ...settings,
    secretAccessKey: settings.secretAccessKey ? SECRET_PLACEHOLDER : "",
  };
}

export function buildAssetObjectKey(
  prefix: string,
  name: string,
  contentType: string,
  bytes: Buffer,
  year: number,
  month: number,
): string {
  const safePrefix = sanitizeAssetPrefix(prefix);
  const stem = safeFileStem(name);
  const extension = extensionForContentType(contentType);
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  return `${safePrefix}/${year.toString().padStart(4, "0")}/${month
    .toString()
    .padStart(2, "0")}/${digest}-${stem}.${extension}`;
}

export function buildAcpAgentArgs(
  command: string,
  env: AcpEnvVar[],
): string[] {
  const commandText = command.trim();
  if (!commandText) throw new Error("ACP command is empty");

  const args: string[] = [];
  for (const item of env) {
    const name = item.name.trim();
    if (!isValidEnvName(name)) {
      throw new Error(`Invalid environment variable: ${name}`);
    }
    args.push(`${name}=${item.value}`);
  }

  args.push(...parseCommandParts(commandText));
  return args;
}

export function buildAcpPolishPrompt(
  content: string,
  instruction: string,
): string {
  const trimmedInstruction = instruction.trim();
  const finalInstruction =
    trimmedInstruction ||
    "Polish the Markdown body for clarity, fluency, and natural expression.";

  return `${finalInstruction}\n\nRules:\n- Return only the polished Markdown body.\n- Preserve Markdown structure, links, code fences, MDX/JSX components, and factual meaning.\n- Keep frontmatter out of the output.\n\nMarkdown body:\n<<<MADINAH_WRITER_BODY\n${content}\nMADINAH_WRITER_BODY`;
}

export function normalizeAcpTimeout(value: number): number {
  if (value === 0) return ACP_DEFAULT_TIMEOUT_SECONDS;
  return Math.max(10, Math.min(600, value));
}

export async function polishTextWithAcp(
  input: AcpPolishInput,
): Promise<AcpPolishResult> {
  const timeoutSeconds = normalizeAcpTimeout(input.timeoutSeconds);
  const content = await withTimeout(
    runAcpPolish(input),
    timeoutSeconds,
    `ACP agent timed out after ${timeoutSeconds}s`,
  );

  const trimmed = content.trim();
  if (!trimmed) throw new Error("ACP agent returned empty content");

  return {
    content: trimmed,
    provider: input.provider,
  };
}

export async function checkAcpAgent(
  input: AcpAgentRuntimeConfig,
): Promise<AcpAgentCheckResult> {
  const timeoutSeconds = normalizeAcpTimeout(input.timeoutSeconds);
  return withTimeout(
    runAcpCheck(input),
    timeoutSeconds,
    `ACP agent timed out after ${timeoutSeconds}s`,
  );
}

export async function copyIconAssets(sourceDir: string, targetDir: string) {
  await ensureDir(targetDir);
  const entries = await readdir(sourceDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) =>
        copyFile(path.join(sourceDir, entry.name), path.join(targetDir, entry.name)),
      ),
  );
}

function documentsDir(context: BackendContext): string {
  return path.join(context.userDataDir, "documents");
}

function documentPath(context: BackendContext, id: string): string {
  if (!id.trim() || id.includes("/") || id.includes("\\") || id.includes("..")) {
    throw new Error("Invalid document id");
  }
  return path.join(documentsDir(context), `${id}.json`);
}

function draftPath(context: BackendContext, filePath: string): string {
  return path.join(context.userDataDir, "drafts", `${hashString(filePath)}.md`);
}

function recentPath(context: BackendContext): string {
  return path.join(context.userDataDir, "recent.json");
}

function pluginTrustPath(context: BackendContext): string {
  return path.join(context.userDataDir, "plugins", "trust.json");
}

function assetUploadSettingsPath(context: BackendContext): string {
  return path.join(context.userDataDir, "asset-upload.json");
}

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function listVisibleChildren(parent: string): Promise<FileTreeNode[]> {
  const entries = await readdir(parent, { withFileTypes: true });
  const nodes = (
    await Promise.all(
      entries.map(async (entry) => {
        const filePath = path.join(parent, entry.name);
        if (entry.isDirectory()) {
          if (shouldIgnoreDirectory(entry.name)) return null;
          return entryForPath(filePath);
        }
        if (entry.isFile() && isMarkdownPath(filePath)) {
          return entryForPath(filePath);
        }
        return null;
      }),
    )
  ).filter((node): node is FileTreeNode => node !== null);

  return nodes.sort(compareFileTreeNodes);
}

async function entryForPath(filePath: string): Promise<FileTreeNode> {
  const fileStat = await stat(filePath);
  const name = path.basename(filePath);

  if (fileStat.isDirectory()) {
    const children = await listVisibleChildren(filePath);
    return {
      path: filePath,
      name,
      kind: "directory",
      childrenCount: children.length,
      children,
    };
  }

  return {
    path: filePath,
    name,
    kind: "file",
    childrenCount: 0,
    children: [],
  };
}

function compareFileTreeNodes(left: FileTreeNode, right: FileTreeNode): number {
  if (left.kind === "directory" && right.kind === "file") return -1;
  if (left.kind === "file" && right.kind === "directory") return 1;
  return left.name.toLowerCase().localeCompare(right.name.toLowerCase());
}

function shouldIgnoreDirectory(name: string): boolean {
  return name.startsWith(".") || name === "node_modules";
}

function validateChildName(name: string): string {
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed === "." ||
    trimmed === ".." ||
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("..")
  ) {
    throw new Error("Invalid file name");
  }
  return trimmed;
}

function isMarkdownPath(filePath: string): boolean {
  return ["md", "mdx", "markdown"].includes(
    path.extname(filePath).slice(1).toLowerCase(),
  );
}

function nextDuplicatePath(filePath: string): string {
  const parent = path.dirname(filePath);
  const extension = path.extname(filePath);
  const stem = path.basename(filePath, extension);
  const first = path.join(parent, `${stem} copy${extension}`);
  if (!existsSync(first)) return first;

  for (let index = 2; ; index += 1) {
    const candidate = path.join(parent, `${stem} copy ${index}${extension}`);
    if (!existsSync(candidate)) return candidate;
  }
}

function uniquePath(filePath: string): string {
  if (!existsSync(filePath)) return filePath;

  const parent = path.dirname(filePath);
  const extension = path.extname(filePath);
  const stem = path.basename(filePath, extension) || "item";

  for (let index = 2; ; index += 1) {
    const candidate = path.join(parent, `${stem}-${index}${extension}`);
    if (!existsSync(candidate)) return candidate;
  }
}

async function realPath(filePath: string): Promise<string> {
  const fs = await import("node:fs/promises");
  return fs.realpath(filePath);
}

function isPathInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashBytes(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectFiles(filePath);
      if (entry.isFile()) return [filePath];
      return [];
    }),
  );
  return nested.flat();
}

function isMdxBlogPath(filePath: string): boolean {
  return [".md", ".mdx"].includes(path.extname(filePath).toLowerCase());
}

function stripExtension(filePath: string): string {
  return filePath.slice(0, filePath.length - path.extname(filePath).length);
}

async function readWorkspaceConfig(root: string): Promise<WorkspaceConfig> {
  const configPath = workspaceConfigPath(root);
  if (!existsSync(configPath)) return defaultWorkspaceConfig();
  const raw = await readJsonFile<Partial<WorkspaceConfig>>(configPath);
  return {
    schemaVersion: Number(raw.schemaVersion ?? 1),
    profile: typeof raw.profile === "string" ? raw.profile : "gfm",
    plugins: Array.isArray(raw.plugins)
      ? raw.plugins.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function workspaceConfigPath(root: string): string {
  return path.join(root, CONFIG_DIR, CONFIG_FILE);
}

async function workspaceInfoFromConfig(
  root: string,
  configPath: string,
): Promise<WorkspaceInfo> {
  const config = await readWorkspaceConfig(root);
  return {
    root,
    configPath,
    profile: config.profile,
    plugins: config.plugins,
  };
}

function defaultWorkspaceInfo(root: string): WorkspaceInfo {
  const config = defaultWorkspaceConfig();
  return {
    root,
    configPath: null,
    profile: config.profile,
    plugins: config.plugins,
  };
}

function defaultWorkspaceConfig(): WorkspaceConfig {
  return {
    schemaVersion: 1,
    profile: "gfm",
    plugins: [],
  };
}

function workspaceSearchStart(inputPath: string): string {
  if (existsSync(inputPath)) {
    try {
      const current = statSyncSafe(inputPath);
      if (current?.isFile()) return path.dirname(inputPath);
      return inputPath;
    } catch {
      return inputPath;
    }
  }

  return path.extname(inputPath) ? path.dirname(inputPath) : inputPath;
}

function statSyncSafe(filePath: string) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function pathAncestors(start: string): string[] {
  const ancestors: string[] = [];
  let current = path.resolve(start);
  for (;;) {
    ancestors.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return ancestors;
}

async function resolvePlugin(
  workspaceRoot: string,
  spec: string,
  trustPath?: string | null,
): Promise<ResolvedPlugin> {
  const packageRoot = resolvePackageRoot(workspaceRoot, spec);
  const manifestPath = path.join(packageRoot, "package.json");
  const manifest = await readJsonFile<PackageManifest>(manifestPath);
  const pluginManifest = manifest.madinahWriter;
  if (!pluginManifest) {
    throw new Error(`Missing madinahWriter manifest: ${manifestPath}`);
  }
  if (pluginManifest.apiVersion !== 1) {
    throw new Error(
      `Unsupported plugin apiVersion ${pluginManifest.apiVersion}: ${manifestPath}`,
    );
  }

  const entryPath = path.join(packageRoot, pluginManifest.entry);
  const bundle = await readFile(entryPath);
  const bundleHash = hashBytes(bundle);
  const packageId = manifest.name ?? spec;
  const version = manifest.version ?? "0.0.0";
  const trusted = trustPath
    ? await isTrustedPlugin(
        trustPath,
        workspaceRoot,
        packageId,
        version,
        bundleHash,
      )
    : false;

  return {
    id: packageId,
    packageId,
    name: spec,
    version,
    workspaceRoot,
    packageRoot,
    entryPath,
    bundleHash,
    trusted,
    capabilities: pluginManifest.capabilities ?? [],
  };
}

function resolvePackageRoot(workspaceRoot: string, spec: string): string {
  if (path.isAbsolute(spec)) return spec;
  if (spec.startsWith(".")) return path.join(workspaceRoot, spec);
  return path.join(workspaceRoot, "node_modules", spec);
}

async function isTrustedPlugin(
  trustPath: string,
  workspaceRoot: string,
  packageId: string,
  version: string,
  bundleHash: string,
): Promise<boolean> {
  const records = await readTrustRecords(trustPath);
  return records.some(
    (record) =>
      record.workspaceRoot === workspaceRoot &&
      record.packageId === packageId &&
      record.version === version &&
      record.bundleHash === bundleHash &&
      record.trusted,
  );
}

async function readTrustRecords(
  trustPath: string,
): Promise<WorkspacePluginTrustRecord[]> {
  if (!existsSync(trustPath)) return [];
  return readJsonFile<WorkspacePluginTrustRecord[]>(trustPath);
}

function unixTimestampString(): string {
  return Math.floor(Date.now() / 1000).toString();
}

async function readStoredAssetUploadSettings(
  context: BackendContext,
): Promise<AssetUploadSettings> {
  return readStoredAssetUploadSettingsFromPath(assetUploadSettingsPath(context));
}

async function readStoredAssetUploadSettingsFromPath(
  settingsPath: string,
): Promise<AssetUploadSettings> {
  if (!existsSync(settingsPath)) return defaultAssetUploadSettings();
  const settings = await readJsonFile<AssetUploadSettings>(settingsPath);
  const normalized = normalizeAssetUploadSettings(settings);
  validateSafeAssetUploadSettingsShape(normalized);
  return normalized;
}

function r2Client(settings: AssetUploadSettings): S3Client {
  return new S3Client({
    endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

function validateSafeAssetUploadSettingsShape(
  settings: AssetUploadSettings,
): void {
  sanitizeAssetPrefix(settings.prefix);
  if (
    !settings.publicBaseUrl.startsWith("https://") &&
    !settings.publicBaseUrl.startsWith("http://")
  ) {
    throw new Error("Public asset URL must start with http:// or https://");
  }
  if (settings.accountId.includes("/") || settings.accountId.includes("\\")) {
    throw new Error("Cloudflare account id is invalid");
  }
}

function validateCompleteAssetUploadSettings(
  settings: AssetUploadSettings,
): void {
  validateSafeAssetUploadSettingsShape(settings);
  if (!settings.accountId) throw new Error("Cloudflare account id is required");
  if (!settings.bucket) throw new Error("R2 bucket is required");
  if (!settings.accessKeyId) throw new Error("R2 access key id is required");
  if (!settings.secretAccessKey || settings.secretAccessKey === SECRET_PLACEHOLDER) {
    throw new Error("R2 secret access key is required");
  }
}

function validateImagePayload(
  input: AssetImageUploadInput,
  decodedSize: number,
  maxBytes: number,
): void {
  extensionForContentType(input.contentType);
  if (decodedSize === 0) throw new Error("Image payload is empty");
  if (input.size !== decodedSize) throw new Error("Image size changed during upload");
  if (decodedSize > maxBytes) throw new Error(`Image is larger than ${maxBytes} bytes`);
}

function extensionForContentType(contentType: string): string {
  switch (contentType.trim().toLowerCase()) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      throw new Error(`Unsupported image type: ${contentType}`);
  }
}

function sanitizeAssetPrefix(prefix: string): string {
  const segments = prefix
    .trim()
    .replace(/\\/gu, "/")
    .replace(/^\/+|\/+$/gu, "")
    .split("/")
    .filter(Boolean);

  if (segments.length === 0) return DEFAULT_PREFIX;

  for (const segment of segments) {
    if (segment === "." || segment === ".." || segment.includes("..")) {
      throw new Error("Asset prefix cannot contain path traversal");
    }
  }

  return segments.join("/");
}

function safeFileStem(name: string): string {
  const parsed = path.basename(name, path.extname(name)) || "image";
  let safe = "";
  let previousDash = false;

  for (const character of parsed) {
    if (/[a-z0-9]/iu.test(character) && character.charCodeAt(0) < 128) {
      safe += character.toLowerCase();
      previousDash = false;
    } else if (!previousDash) {
      safe += "-";
      previousDash = true;
    }
  }

  const trimmed = safe.replace(/^-+|-+$/gu, "");
  return trimmed || "image";
}

function fallbackIfEmpty(value: string, fallback: string): string {
  return value.trim() || fallback;
}

function publicAssetUrl(baseUrl: string, key: string): string {
  return `${baseUrl.trim().replace(/\/+$/u, "")}/${key.replace(/^\/+/u, "")}`;
}

function parseCommandParts(command: string): string[] {
  const parsed = parseShellCommand(command);
  const parts: string[] = [];
  for (const part of parsed) {
    if (typeof part === "string") {
      parts.push(part);
      continue;
    }
    throw new Error("Failed to parse ACP command: unsupported shell syntax");
  }
  if (parts.length === 0) throw new Error("ACP command is empty");
  return parts;
}

function isValidEnvName(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/u.test(value);
}

async function runAcpPolish(input: AcpPolishInput): Promise<string> {
  const prompt = buildAcpPolishPrompt(input.content, input.instruction);
  return runAcpAgentForText({
    command: input.command,
    env: input.env,
    cwd: workspaceDir(input.workspaceRoot),
    prompt,
  });
}

async function runAcpCheck(
  input: AcpAgentRuntimeConfig,
): Promise<AcpAgentCheckResult> {
  await runAcpAgentInitialize({
    command: input.command,
    env: input.env,
    cwd: process.cwd(),
  });
  return {
    ok: true,
    agentName: null,
    message: "Connected",
  };
}

async function runAcpAgentForText(options: {
  command: string;
  env: AcpEnvVar[];
  cwd: string;
  prompt: string;
}): Promise<string> {
  const child = spawnAcpAgent(options.command, options.env, options.cwd);
  const stream = acp.ndJsonStream(
    Writable.toWeb(child.stdin!),
    Readable.toWeb(child.stdout!) as ReadableStream,
  );

  try {
    return await acp
      .client({ name: "madinah-writer" })
      .onRequest(acp.methods.client.session.requestPermission, async () => ({
        outcome: { outcome: "cancelled" },
      }))
      .connectWith(stream, async (ctx) => {
        await ctx.request(acp.methods.agent.initialize, {
          protocolVersion: acp.PROTOCOL_VERSION,
          clientInfo: {
            name: "madinah-writer",
            version: "0.1.0",
          },
        });

        return ctx.buildSession(options.cwd).withSession(async (session) => {
          void session.prompt(options.prompt);
          return session.readText();
        });
      });
  } finally {
    child.kill();
  }
}

async function runAcpAgentInitialize(options: {
  command: string;
  env: AcpEnvVar[];
  cwd: string;
}): Promise<void> {
  const child = spawnAcpAgent(options.command, options.env, options.cwd);
  const stream = acp.ndJsonStream(
    Writable.toWeb(child.stdin!),
    Readable.toWeb(child.stdout!) as ReadableStream,
  );

  try {
    await acp
      .client({ name: "madinah-writer" })
      .onRequest(acp.methods.client.session.requestPermission, async () => ({
        outcome: { outcome: "cancelled" },
      }))
      .connectWith(stream, async (ctx) => {
        await ctx.request(acp.methods.agent.initialize, {
          protocolVersion: acp.PROTOCOL_VERSION,
          clientInfo: {
            name: "madinah-writer",
            version: "0.1.0",
          },
        });
      });
  } finally {
    child.kill();
  }
}

function spawnAcpAgent(command: string, env: AcpEnvVar[], cwd: string) {
  const args = buildAcpAgentArgs(command, env);
  const commandParts = args.slice(env.length);
  const envRecord = Object.fromEntries(env.map((item) => [item.name.trim(), item.value]));
  const child = spawn(commandParts[0], commandParts.slice(1), {
    cwd,
    env: {
      ...process.env,
      ...envRecord,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr?.on("data", (chunk) => {
    console.error(String(chunk));
  });
  return child;
}

function workspaceDir(workspaceRoot?: string | null): string {
  const trimmed = workspaceRoot?.trim();
  return trimmed || process.cwd();
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutSeconds: number,
  message: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutSeconds * 1000);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

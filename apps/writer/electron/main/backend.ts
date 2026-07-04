import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
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
  AcpAiActionInput,
  AcpAiActionResult,
  AcpAgentCheckResult,
  AcpAgentRuntimeConfig,
  AcpEnvVar,
  AiDocumentReview,
  AiDocumentReviewIssue,
  AiDocumentReviewIssueSeverity,
  AiMetadataSuggestion,
  AcpPolishInput,
  AcpPolishResult,
} from "../../src/domain/ai-polish";
import type {
  AssetImageUploadInput,
  AssetImageUploadResult,
  AssetUploadCheckResult,
  AssetUploadProvider,
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
const DEFAULT_ASSET_PROVIDER: AssetUploadProvider = "cloudflare-r2-worker";
const DEFAULT_ASSET_ENDPOINT = "";
const DEFAULT_PUBLIC_BASE_URL = "https://assets.felixwliu.cn";
const DEFAULT_PREFIX = "images/writer";
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const MAX_ALLOWED_BYTES = 500 * 1024 * 1024;
const CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable";
const ACP_DEFAULT_TIMEOUT_SECONDS = 120;
const ACP_RESULT_START = "MADINAH_WRITER_RESULT_START";
const ACP_RESULT_END = "MADINAH_WRITER_RESULT_END";
const ACP_MEDIUM_THINKING_EFFORT = "medium";
const ACP_THINKING_CONFIG_IDS = new Set(["reasoning_effort", "effort"]);

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
  if (await pathExists(filePath)) throw new Error(`${filePath} already exists`);

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
  if (await pathExists(dirPath)) throw new Error(`${dirPath} already exists`);

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
  if (await pathExists(target)) throw new Error(`${target} already exists`);

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
  const target = await nextDuplicatePath(filePath);
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
  if (!(await pathExists(filePath))) throw new Error(`Path not found: ${filePath}`);

  const canonicalRoot = await realPath(workspaceRoot);
  const canonicalPath = await realPath(filePath);
  if (!isPathInside(canonicalPath, canonicalRoot)) {
    throw new Error("Path is outside the workspace");
  }

  const trashDir = path.join(workspaceRoot, CONFIG_DIR, "trash");
  await ensureDir(trashDir);

  const originalName = path.basename(filePath);
  if (!originalName) throw new Error("Invalid path name");

  const target = await uniquePath(
    path.join(trashDir, `${Date.now()}-${originalName}`),
  );
  await rename(filePath, target);
  return target;
}

export async function listRecentFiles(
  context: BackendContext,
): Promise<MarkdownFile[]> {
  const filePath = recentPath(context);
  if (!(await pathExists(filePath))) return [];
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
  const blogsDir = await resolveBlogsDir(inputPath);
  if (!(await pathExists(blogsDir))) {
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
  const blogsDir = await resolveBlogsDir(input.blogDir);
  await ensureDir(blogsDir);

  const outputPath = exportPathForSlug(blogsDir, input.slug);
  if (!input.overwrite && (await pathExists(outputPath))) {
    throw new Error(`${outputPath} already exists`);
  }

  await ensureDir(path.dirname(outputPath));
  await writeFile(outputPath, input.source, "utf8");
  return { path: outputPath };
}

export async function resolveBlogsDir(inputPath: string): Promise<string> {
  if (path.basename(inputPath) === "blogs") return inputPath;

  const nested = path.join(inputPath, "src", "blogs");
  if (
    (await pathExists(nested)) ||
    !(await pathExists(path.join(inputPath, "src")))
  ) {
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
  const start = await workspaceSearchStart(inputPath);
  const ancestors = pathAncestors(start);

  for (const ancestor of ancestors) {
    const configPath = workspaceConfigPath(ancestor);
    if (await pathExists(configPath)) {
      return workspaceInfoFromConfig(ancestor, configPath);
    }
  }

  for (const ancestor of ancestors) {
    if (await pathExists(path.join(ancestor, "package.json"))) {
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
    await assetUploadProvider(next.provider).check(next);
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

  await assetUploadProvider(settings.provider).uploadImage(settings, {
    key,
    bytes,
    contentType: input.contentType,
  });

  return {
    key,
    url: publicAssetUrl(settings.publicBaseUrl, key),
    size: input.size,
    contentType: input.contentType,
  };
}

export function defaultAssetUploadSettings(): AssetUploadSettings {
  return {
    schemaVersion: 2,
    provider: DEFAULT_ASSET_PROVIDER,
    endpoint: DEFAULT_ASSET_ENDPOINT,
    apiKey: "",
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
  settings: unknown,
): AssetUploadSettings {
  const fallback = defaultAssetUploadSettings();
  if (!isRecord(settings)) return fallback;

  return {
    schemaVersion: 2,
    provider: normalizeAssetUploadProvider(settings.provider),
    endpoint: fallbackIfEmpty(
      normalizeBaseUrl(settings.endpoint),
      fallback.endpoint,
    ),
    apiKey: normalizeString(settings.apiKey),
    publicBaseUrl: fallbackIfEmpty(
      normalizeBaseUrl(settings.publicBaseUrl ?? settings.customDomain),
      fallback.publicBaseUrl,
    ),
    prefix: fallbackIfEmpty(
      normalizeString(settings.prefix)
        .replace(/\\/gu, "/")
        .replace(/^\/+|\/+$/gu, ""),
      fallback.prefix,
    ),
    maxBytes: normalizeAssetMaxBytes(settings.maxBytes, fallback.maxBytes),
  };
}

export function preservePlaceholderSecret(
  settings: AssetUploadSettings,
  current: AssetUploadSettings,
): AssetUploadSettings {
  if (settings.apiKey.trim() === SECRET_PLACEHOLDER) {
    return {
      ...settings,
      apiKey: current.apiKey,
    };
  }

  return settings;
}

export function maskAssetUploadSecret(
  settings: AssetUploadSettings,
): AssetUploadSettings {
  return {
    ...settings,
    apiKey: settings.apiKey ? SECRET_PLACEHOLDER : "",
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
  return buildAcpActionPrompt({
    kind: "polish-document",
    content,
    instruction,
  });
}

export function buildAcpActionPrompt(
  input: Pick<AcpAiActionInput, "kind" | "content" | "instruction">,
): string {
  const content = input.content.trim();
  const trimmedInstruction = input.instruction.trim();
  const extraInstruction = trimmedInstruction
    ? `\n\nAdditional writing instruction:\n${trimmedInstruction}`
    : "";

  if (input.kind === "rewrite-selection") {
    return `Rewrite the selected Markdown for clarity, fluency, and natural expression.${extraInstruction}\n\nRules:\n- Return only the rewritten selected Markdown.\n- Preserve factual meaning, Markdown structure, links, code fences, and MDX/JSX components.\n- Do not add commentary or wrap the result in a code fence.\n${buildAcpResultEnvelopeInstruction()}\n\nSelected Markdown:\n<<<MADINAH_WRITER_SELECTION\n${content}\nMADINAH_WRITER_SELECTION`;
  }

  if (input.kind === "generate-metadata") {
    return `Generate publication metadata for the Markdown body.${extraInstruction}\n\nReturn only valid JSON with this exact shape:\n{\n  "title": "string",\n  "description": "string",\n  "tags": ["string"],\n  "slug": "string"\n}\n\nRules:\n- Keep the title concise and specific.\n- Keep description under 180 characters.\n- Return 3 to 6 lowercase tags when possible.\n- Use a URL-safe kebab-case slug.\n- Do not include Markdown fences or explanatory text.\n${buildAcpResultEnvelopeInstruction()}\n\nMarkdown body:\n<<<MADINAH_WRITER_BODY\n${content}\nMADINAH_WRITER_BODY`;
  }

  if (input.kind === "review-document") {
    return `Review the Markdown document for structure, clarity, and publishing readiness.${extraInstruction}\n\nReturn only valid JSON with this exact shape:\n{\n  "summary": "string",\n  "issues": [\n    {\n      "severity": "info | warning | critical",\n      "title": "string",\n      "detail": "string",\n      "suggestion": "string"\n    }\n  ]\n}\n\nRules:\n- Prefer concrete issues over generic advice.\n- Use "critical" only for issues that block publication or make the article misleading.\n- Keep every field concise.\n- Do not include Markdown fences or explanatory text.\n${buildAcpResultEnvelopeInstruction()}\n\nMarkdown body:\n<<<MADINAH_WRITER_BODY\n${content}\nMADINAH_WRITER_BODY`;
  }

  const finalInstruction =
    trimmedInstruction ||
    "Polish the Markdown body for clarity, fluency, and natural expression.";

  return `${finalInstruction}\n\nRules:\n- Return only the polished Markdown body.\n- Preserve Markdown structure, links, code fences, MDX/JSX components, and factual meaning.\n- Keep frontmatter out of the output.\n${buildAcpResultEnvelopeInstruction()}\n\nMarkdown body:\n<<<MADINAH_WRITER_BODY\n${content}\nMADINAH_WRITER_BODY`;
}

export function normalizeAcpTimeout(value: number): number {
  if (value === 0) return ACP_DEFAULT_TIMEOUT_SECONDS;
  return Math.max(10, Math.min(600, value));
}

export function getAcpMediumThinkingConfigRequests(
  configOptions: unknown,
): Array<{ configId: string; value: string }> {
  if (!Array.isArray(configOptions)) return [];

  return configOptions.flatMap((option) => {
    if (!isRecord(option) || typeof option.id !== "string") return [];
    if (!ACP_THINKING_CONFIG_IDS.has(option.id)) return [];
    if (option.currentValue === ACP_MEDIUM_THINKING_EFFORT) return [];

    const options = Array.isArray(option.options) ? option.options : [];
    const supportsMedium = options.some(
      (item) =>
        isRecord(item) && item.value === ACP_MEDIUM_THINKING_EFFORT,
    );
    if (!supportsMedium) return [];

    return [
      {
        configId: option.id,
        value: ACP_MEDIUM_THINKING_EFFORT,
      },
    ];
  });
}

export async function polishTextWithAcp(
  input: AcpPolishInput,
): Promise<AcpPolishResult> {
  const result = await runAiActionWithAcp({
    ...input,
    kind: "polish-document",
  });
  return {
    content: result.content,
    provider: result.provider,
  };
}

export async function runAiActionWithAcp(
  input: AcpAiActionInput,
): Promise<AcpAiActionResult> {
  const timeoutSeconds = normalizeAcpTimeout(input.timeoutSeconds);
  const rawContent = await withTimeout(
    runAcpAction(input),
    timeoutSeconds,
    `ACP agent timed out after ${timeoutSeconds}s`,
  );

  const trimmed = normalizeAcpActionText(rawContent);
  if (!trimmed) throw new Error("ACP agent returned empty content");

  const base = {
    kind: input.kind,
    content: trimmed,
    provider: input.provider,
  };

  if (input.kind === "generate-metadata") {
    return {
      ...base,
      metadata: parseAiMetadataSuggestion(trimmed),
    };
  }

  if (input.kind === "review-document") {
    return {
      ...base,
      review: parseAiDocumentReview(trimmed),
    };
  }

  return base;
}

export function normalizeAcpActionText(value: string): string {
  const withoutDiagnostics = stripAcpDiagnosticOutput(value);
  const enveloped = extractAcpResultEnvelope(withoutDiagnostics);
  const trimmed = (enveloped ?? withoutDiagnostics).trim();
  const fenced = trimmed.match(/^```(?:json|markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function buildAcpResultEnvelopeInstruction(): string {
  return `- Put the final payload between ${ACP_RESULT_START} and ${ACP_RESULT_END}.
- Do not put warnings, notes, or explanations outside those markers.`;
}

function extractAcpResultEnvelope(value: string): string | null {
  const pattern = new RegExp(
    `${escapeRegExp(ACP_RESULT_START)}\\s*\\n?([\\s\\S]*?)\\n?\\s*${escapeRegExp(ACP_RESULT_END)}`,
    "g",
  );
  let match: RegExpExecArray | null = null;
  let lastMatch: RegExpExecArray | null = null;

  while ((match = pattern.exec(value)) !== null) {
    lastMatch = match;
  }

  return lastMatch?.[1] ?? null;
}

function stripAcpDiagnosticOutput(value: string): string {
  return value
    .split(/\r?\n/u)
    .filter((line) => !isAcpDiagnosticLine(line))
    .join("\n")
    .trim();
}

function isAcpDiagnosticLine(line: string): boolean {
  const normalized = line.replace(/\u001b\[[0-9;]*m/gu, "").trim();
  return /^Warning: Skill descriptions were shortened to fit the \d+% skills context budget\./u.test(
    normalized,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function parseAiMetadataSuggestion(value: string): AiMetadataSuggestion {
  const parsed = parseAcpJsonObject(value, "metadata suggestion");
  const title = stringField(parsed, "title");
  const description = stringField(parsed, "description");
  const tagsValue = parsed.tags;
  const tags = Array.isArray(tagsValue)
    ? [
        ...new Set(
          tagsValue
            .map((tag) => String(tag).trim().toLowerCase())
            .filter(Boolean),
        ),
      ]
    : [];
  const slug = slugField(parsed.slug || title);

  return {
    title,
    description,
    tags,
    slug,
  };
}

export function parseAiDocumentReview(value: string): AiDocumentReview {
  const parsed = parseAcpJsonObject(value, "document review");
  const issuesValue = parsed.issues;

  return {
    summary: stringField(parsed, "summary"),
    issues: Array.isArray(issuesValue)
      ? issuesValue.flatMap((issue): AiDocumentReviewIssue[] => {
          if (!isRecord(issue)) return [];
          const title = stringField(issue, "title", false);
          const detail = stringField(issue, "detail", false);
          const suggestion = stringField(issue, "suggestion", false);
          if (!title && !detail && !suggestion) return [];
          return [
            {
              severity: reviewSeverity(issue.severity),
              title: title || "Writing issue",
              detail,
              suggestion,
            },
          ];
        })
      : [],
  };
}

function parseAcpJsonObject(value: string, label: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(normalizeAcpActionText(value));
    if (isRecord(parsed)) return parsed;
  } catch {
    // Throw the normalized error below so callers get a stable message.
  }

  throw new Error(`ACP agent returned invalid ${label} JSON`);
}

function stringField(
  record: Record<string, unknown>,
  key: string,
  required = true,
): string {
  const value = record[key];
  const text = typeof value === "string" ? value.trim() : "";
  if (!text && required) {
    throw new Error(`ACP agent returned metadata without ${key}`);
  }
  return text;
}

function slugField(value: unknown): string {
  const raw = typeof value === "string" ? value : String(value ?? "");
  const slug = raw
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

function reviewSeverity(value: unknown): AiDocumentReviewIssueSeverity {
  return value === "critical" || value === "warning" || value === "info"
    ? value
    : "info";
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

async function pathExists(filePath: string): Promise<boolean> {
  return access(filePath).then(
    () => true,
    () => false,
  );
}

async function nextDuplicatePath(filePath: string): Promise<string> {
  const parent = path.dirname(filePath);
  const extension = path.extname(filePath);
  const stem = path.basename(filePath, extension);
  const first = path.join(parent, `${stem} copy${extension}`);
  if (!(await pathExists(first))) return first;

  for (let index = 2; ; index += 1) {
    const candidate = path.join(parent, `${stem} copy ${index}${extension}`);
    if (!(await pathExists(candidate))) return candidate;
  }
}

async function uniquePath(filePath: string): Promise<string> {
  if (!(await pathExists(filePath))) return filePath;

  const parent = path.dirname(filePath);
  const extension = path.extname(filePath);
  const stem = path.basename(filePath, extension) || "item";

  for (let index = 2; ; index += 1) {
    const candidate = path.join(parent, `${stem}-${index}${extension}`);
    if (!(await pathExists(candidate))) return candidate;
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

function hashBytes(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

const COLLECT_FILES_MAX_DEPTH = 8;

async function collectFiles(dir: string, depth = 0): Promise<string[]> {
  if (depth > COLLECT_FILES_MAX_DEPTH) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (shouldIgnoreDirectory(entry.name)) return [];
        return collectFiles(filePath, depth + 1);
      }
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
  if (!(await pathExists(configPath))) return defaultWorkspaceConfig();
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

async function workspaceSearchStart(inputPath: string): Promise<string> {
  const current = await stat(inputPath).catch(() => null);
  if (current) {
    return current.isFile() ? path.dirname(inputPath) : inputPath;
  }

  return path.extname(inputPath) ? path.dirname(inputPath) : inputPath;
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
  if (!(await pathExists(trustPath))) return [];
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
  if (!(await pathExists(settingsPath))) return defaultAssetUploadSettings();
  const settings = await readJsonFile<unknown>(settingsPath);
  const normalized = normalizeAssetUploadSettings(settings);
  validateSafeAssetUploadSettingsShape(normalized);
  return normalized;
}

function validateSafeAssetUploadSettingsShape(
  settings: AssetUploadSettings,
): void {
  if (settings.provider !== "cloudflare-r2-worker") {
    throw new Error(`Unsupported asset upload provider: ${settings.provider}`);
  }
  if (settings.endpoint && !isHttpUrl(settings.endpoint)) {
    throw new Error("Asset upload endpoint must start with http:// or https://");
  }
  sanitizeAssetPrefix(settings.prefix);
  if (
    !settings.publicBaseUrl.startsWith("https://") &&
    !settings.publicBaseUrl.startsWith("http://")
  ) {
    throw new Error("Public asset URL must start with http:// or https://");
  }
}

function validateCompleteAssetUploadSettings(
  settings: AssetUploadSettings,
): void {
  validateSafeAssetUploadSettingsShape(settings);
  if (!settings.endpoint) throw new Error("Asset upload endpoint is required");
  if (!settings.apiKey || settings.apiKey === SECRET_PLACEHOLDER) {
    throw new Error("Asset upload API key is required");
  }
}

interface AssetProviderUploadInput {
  key: string;
  bytes: Buffer;
  contentType: string;
}

interface AssetUploadProviderAdapter {
  check(settings: AssetUploadSettings): Promise<void>;
  uploadImage(
    settings: AssetUploadSettings,
    input: AssetProviderUploadInput,
  ): Promise<void>;
}

const cloudflareR2WorkerAssetUploadProvider: AssetUploadProviderAdapter = {
  async check(settings) {
    const response = await fetch(assetEndpointUrl(settings.endpoint, "health"), {
      headers: {
        "x-api-key": settings.apiKey,
      },
    });
    await assertAssetUploadResponse(response, "Asset upload service check failed");
  },
  async uploadImage(settings, input) {
    const response = await fetch(assetEndpointUrl(settings.endpoint, input.key), {
      method: "PUT",
      headers: {
        "cache-control": CACHE_CONTROL_IMMUTABLE,
        "content-type": input.contentType,
        "x-api-key": settings.apiKey,
      },
      body: new Uint8Array(input.bytes),
    });
    await assertAssetUploadResponse(response, "Image upload failed");
  },
};

const ASSET_UPLOAD_PROVIDERS: Record<
  AssetUploadProvider,
  AssetUploadProviderAdapter
> = {
  "cloudflare-r2-worker": cloudflareR2WorkerAssetUploadProvider,
};

function assetUploadProvider(
  provider: AssetUploadProvider,
): AssetUploadProviderAdapter {
  return ASSET_UPLOAD_PROVIDERS[provider];
}

async function assertAssetUploadResponse(
  response: Response,
  fallback: string,
): Promise<void> {
  if (response.ok) return;

  const body = await response.text().catch(() => "");
  const message = body.trim() || response.statusText || fallback;
  throw new Error(`${fallback}: ${response.status} ${message}`);
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

function normalizeAssetUploadProvider(value: unknown): AssetUploadProvider {
  return value === "cloudflare-r2-worker"
    ? "cloudflare-r2-worker"
    : DEFAULT_ASSET_PROVIDER;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBaseUrl(value: unknown): string {
  return normalizeString(value).replace(/\/+$/u, "");
}

function normalizeAssetMaxBytes(value: unknown, fallback: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1024, Math.min(MAX_ALLOWED_BYTES, Math.round(numeric)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("https://") || value.startsWith("http://");
}

function assetEndpointUrl(endpoint: string, key: string): string {
  const baseUrl = endpoint.trim().replace(/\/+$/u, "");
  const pathName = key
    .replace(/^\/+/u, "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${baseUrl}/${pathName}`;
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
  return runAcpAction({
    ...input,
    kind: "polish-document",
  });
}

async function runAcpAction(input: AcpAiActionInput): Promise<string> {
  const prompt = buildAcpActionPrompt(input);
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

// Lazy-load the ACP SDK so it stays out of the app startup path.
function loadAcpSdk() {
  return import("@agentclientprotocol/sdk");
}

async function runAcpAgentForText(options: {
  command: string;
  env: AcpEnvVar[];
  cwd: string;
  prompt: string;
}): Promise<string> {
  const acp = await loadAcpSdk();
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
          await applyAcpMediumThinkingEffort(acp.methods, ctx, session);
          void session.prompt(options.prompt);
          return session.readText();
        });
      });
  } finally {
    child.kill();
  }
}

async function applyAcpMediumThinkingEffort(
  methods: AcpMethodsLike,
  ctx: AcpClientContextLike,
  session: AcpSessionLike,
): Promise<void> {
  const requests = getAcpMediumThinkingConfigRequests(
    session.newSessionResponse?.configOptions,
  );

  for (const request of requests) {
    try {
      await ctx.request(methods.agent.session.setConfigOption, {
        sessionId: session.sessionId,
        configId: request.configId,
        value: request.value,
      });
    } catch (error) {
      console.warn(
        `Failed to set ACP ${request.configId} to ${request.value}: ${errorMessage(error)}`,
      );
    }
  }
}

interface AcpMethodsLike {
  agent: {
    session: {
      setConfigOption: string;
    };
  };
}

interface AcpClientContextLike {
  request(method: string, params: unknown): Promise<unknown>;
}

interface AcpSessionLike {
  sessionId: string;
  newSessionResponse?: {
    configOptions?: unknown;
  };
}

async function runAcpAgentInitialize(options: {
  command: string;
  env: AcpEnvVar[];
  cwd: string;
}): Promise<void> {
  const acp = await loadAcpSdk();
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

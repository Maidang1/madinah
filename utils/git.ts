import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Configuration for GitHub repository integration
 */
export interface GitConfig {
  githubRepo?: string; // e.g., "username/repo"
  githubBranch?: string; // e.g., "main"
}

/**
 * Git history cache structure
 */
interface GitHistoryCache {
  generatedAt: string;
  files: Record<string, PostGitInfo>;
}

/**
 * Represents a single commit in a blog post's version history
 */
export interface PostCommit {
  hash: string; // Short commit hash (7 chars)
  date: string; // ISO 8601 timestamp
  message: string; // Commit message
  author: string; // Commit author name
  githubUrl?: string; // Full GitHub commit URL
}

/**
 * Git-derived timestamps for a blog post
 */
export interface PostGitInfo {
  createdAt: string; // ISO 8601 timestamp of first commit
  updatedAt: string; // ISO 8601 timestamp of last commit
  commits: PostCommit[]; // Version history (newest first)
}

/**
 * Load Git configuration from package.json or environment
 * Extracts GitHub repository information for generating commit URLs
 */
export function loadGitConfig(): GitConfig {
  try {
    // Dynamically resolve the workspace root
    const workspaceRoot = process.cwd();
    const packageJsonPath = path.join(workspaceRoot, 'package.json');

    // Use dynamic import for ESM compatibility
    const packageJsonContent = execSync(`cat "${packageJsonPath}"`, { encoding: 'utf-8' });
    const packageJson = JSON.parse(packageJsonContent) as {
      repository?: string | { url?: string };
      [key: string]: unknown;
    };

    const repoUrl = typeof packageJson.repository === 'string'
      ? packageJson.repository
      : packageJson.repository?.url;

    if (repoUrl) {
      // Extract owner/repo from GitHub URL
      // Supports both https://github.com/owner/repo and git@github.com:owner/repo formats
      const match = repoUrl.match(/github\.com[:/]([^/]+\/[^/.]+)/);
      if (match) {
        return {
          githubRepo: match[1].replace('.git', ''),
          githubBranch: 'main', // Default branch
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load Git config:', error);
  }

  return {};
}

/**
 * Load Git history from cache file
 * Used in CI/CD environments where full Git history is not available
 */
function loadGitHistoryCache(): GitHistoryCache | null {
  try {
    const workspaceRoot = process.cwd();
    const cachePath = path.join(workspaceRoot, 'app/data/git-history.json');

    if (fs.existsSync(cachePath)) {
      const cacheContent = fs.readFileSync(cachePath, 'utf-8');
      return JSON.parse(cacheContent) as unknown as GitHistoryCache;
    }
  } catch (error) {
    console.warn('Failed to load Git history cache:', error);
  }

  return null;
}

/**
 * Extract Git commit history for a specific file
 * Returns creation time, update time, and full commit history
 * 
 * Strategy:
 * 1. Try to load from cache file (for CI/CD environments)
 * 2. Fall back to git log command (for local development)
 * 
 * @param filePath - Absolute or relative path to the file
 * @param config - Git configuration including GitHub repository info
 * @returns PostGitInfo object or null if Git history unavailable
 */
export function getFileGitHistory(
  filePath: string,
  config: GitConfig = {},
): PostGitInfo | null {
  const workspaceRoot = process.cwd();
  const relativePath = path.relative(workspaceRoot, filePath);

  // Strategy 1: Try to load from cache
  const cache = loadGitHistoryCache();
  if (cache && cache.files[relativePath]) {
    console.log(`📦 Using cached Git history for ${relativePath}`);
    return cache.files[relativePath];
  }

  // Strategy 2: Fall back to git log command
  try {
    // Get all commits for the file, newest first
    // Format: hash|ISO date|author name|commit message
    const gitLog = execSync(
      `git log --follow --format="%H|%aI|%an|%s" -- "${filePath}"`,
      {
        encoding: 'utf-8',
        cwd: workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe'] // Suppress stderr warnings
      },
    ).trim();

    if (!gitLog) {
      console.warn(`No Git history found for ${filePath}`);
      return null; // File not in Git history
    }

    const lines = gitLog.split('\n');
    const allCommits: PostCommit[] = lines.map((line) => {
      const [hash, date, author, ...messageParts] = line.split('|');
      const message = messageParts.join('|'); // Rejoin in case message contains |
      const shortHash = hash.substring(0, 7);

      return {
        hash: shortHash,
        date,
        author,
        message,
        githubUrl: config.githubRepo
          ? `https://github.com/${config.githubRepo}/commit/${hash}`
          : undefined,
      };
    });

    // Filter out noise commits based on commit message patterns
    const filteredCommits = allCommits.filter((commit) => {
      const lowerMessage = commit.message.toLowerCase().trim();

      // Exclude commits starting with noise prefixes
      const noisePatterns = [
        /^chore[:\s]/,
        /^style[:\s]/,
        /^format[:\s]/,
        /^typo[:\s]/,
        /^fix typo/i,
      ];

      return !noisePatterns.some(pattern => pattern.test(lowerMessage));
    });

    // Always include at least the most recent commit even if filtered
    const commits = filteredCommits.length > 0
      ? filteredCommits
      : [allCommits[0]];

    if (commits.length === 0) {
      console.warn(`All commits filtered out for ${filePath}`);
      return null;
    }

    // First commit in the list is the most recent (newest first)
    // Last commit in the list is the oldest (creation)
    const createdAt = commits[commits.length - 1].date;
    const updatedAt = commits[0].date;

    return {
      createdAt,
      updatedAt,
      commits,
    };
  } catch (error) {
    console.warn(`Failed to get Git history for ${filePath}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

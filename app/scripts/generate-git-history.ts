#!/usr/bin/env node
/**
 * Generate Git history cache for blog posts
 * This script extracts Git commit history for all blog posts and saves it to a JSON file.
 * Used in CI/CD environments where full Git history is not available.
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

interface PostCommit {
  hash: string;
  date: string;
  message: string;
  author: string;
  githubUrl?: string;
}

interface PostGitInfo {
  createdAt: string;
  updatedAt: string;
  commits: PostCommit[];
}

interface GitHistoryCache {
  generatedAt: string;
  files: Record<string, PostGitInfo>;
}

interface GitConfig {
  githubRepo?: string;
  githubBranch?: string;
}

function loadGitConfig(): GitConfig {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJsonContent = JSON.parse(
      execSync(`cat "${packageJsonPath}"`, { encoding: 'utf-8' })
    );

    const repoUrl =
      typeof packageJsonContent.repository === 'string'
        ? packageJsonContent.repository
        : packageJsonContent.repository?.url;

    if (repoUrl) {
      const match = repoUrl.match(/github\.com[:/]([^/]+\/[^/.]+)/);
      if (match) {
        return {
          githubRepo: match[1].replace('.git', ''),
          githubBranch: 'main',
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load Git config:', error);
  }

  return {};
}

function getFileGitHistory(
  filePath: string,
  config: GitConfig
): PostGitInfo | null {
  try {
    const gitLog = execSync(
      `git log --follow --format="%H|%aI|%an|%s" -- "${filePath}"`,
      {
        encoding: 'utf-8',
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    ).trim();

    if (!gitLog) {
      return null;
    }

    const lines = gitLog.split('\n');
    const allCommits: PostCommit[] = lines.map((line) => {
      const [hash, date, author, ...messageParts] = line.split('|');
      const message = messageParts.join('|');
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

    const filteredCommits = allCommits.filter((commit) => {
      const lowerMessage = commit.message.toLowerCase().trim();
      const noisePatterns = [
        /^chore[:\s]/,
        /^style[:\s]/,
        /^format[:\s]/,
        /^typo[:\s]/,
        /^fix typo/i,
      ];
      return !noisePatterns.some((pattern) => pattern.test(lowerMessage));
    });

    const commits =
      filteredCommits.length > 0 ? filteredCommits : [allCommits[0]];

    if (commits.length === 0) {
      return null;
    }

    return {
      createdAt: commits[commits.length - 1].date,
      updatedAt: commits[0].date,
      commits,
    };
  } catch (error) {
    console.warn(`Failed to get Git history for ${filePath}:`, error);
    return null;
  }
}

async function findBlogPosts(): Promise<string[]> {
  const blogPosts: string[] = [];
  const scanDirs = [
    { path: 'app/routes', pattern: /^blogs\..*\.(mdx|md)$/ },
    { path: 'app/features', pattern: /\.(mdx|md)$/, recursive: true },
  ];

  for (const { path: dirPath, pattern, recursive } of scanDirs) {
    try {
      const fullPath = path.join(process.cwd(), dirPath);

      if (recursive) {
        // Recursively scan features directory
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const contentDir = path.join(fullPath, entry.name, 'content');
            try {
              const scanContentDir = async (dir: string) => {
                const files = await fs.readdir(dir, { withFileTypes: true });
                for (const file of files) {
                  const filePath = path.join(dir, file.name);
                  if (file.isDirectory()) {
                    await scanContentDir(filePath);
                  } else if (pattern.test(file.name)) {
                    blogPosts.push(filePath);
                  }
                }
              };
              await scanContentDir(contentDir);
            } catch {
              // Content directory doesn't exist, skip
            }
          }
        }
      } else {
        // Scan routes directory for blog posts
        const files = await fs.readdir(fullPath);
        for (const file of files) {
          if (pattern.test(file)) {
            blogPosts.push(path.join(fullPath, file));
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error);
    }
  }

  return blogPosts;
}

async function generateGitHistoryCache() {
  console.log('🔍 Scanning for blog posts...');
  const blogPosts = await findBlogPosts();
  console.log(`📝 Found ${blogPosts.length} blog posts`);

  const gitConfig = loadGitConfig();
  console.log('⚙️  Git config:', gitConfig);

  const cache: GitHistoryCache = {
    generatedAt: new Date().toISOString(),
    files: {},
  };

  for (const filePath of blogPosts) {
    console.log(`📊 Processing: ${filePath}`);
    const gitInfo = getFileGitHistory(filePath, gitConfig);

    if (gitInfo) {
      // Use relative path as key for portability
      const relativePath = path.relative(process.cwd(), filePath);
      cache.files[relativePath] = gitInfo;
      console.log(
        `  ✅ ${gitInfo.commits.length} commits (${gitInfo.createdAt} → ${gitInfo.updatedAt})`
      );
    } else {
      console.log(`  ⚠️  No Git history found`);
    }
  }

  const outputPath = path.join(process.cwd(), 'app/data/git-history.json');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(cache, null, 2));

  console.log(`\n✨ Git history cache generated: ${outputPath}`);
  console.log(`📦 Cached ${Object.keys(cache.files).length} files`);
}

generateGitHistoryCache().catch((error) => {
  console.error('❌ Failed to generate Git history cache:', error);
  process.exit(1);
});

/**
 * Git history utilities for blog posts
 * Extracts creation and update dates from git history
 */

export interface PostCommit {
  hash: string;
  date: string;
  message: string;
  author: string;
  githubUrl?: string;
}

export interface PostGitInfo {
  createdAt: string;
  updatedAt: string;
  commits: PostCommit[];
}

/**
 * Get git history for a file
 * Note: This is a placeholder for Astro build-time integration
 * In production, you would use a build script to generate this data
 */
export function getFileGitHistory(filePath: string): PostGitInfo | null {
  // This would be populated by a build script
  // For now, return null and fall back to frontmatter dates
  return null;
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return String(date);
  }
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

# Design Document: Blog Last Modified Time with Git History

## Overview

This feature extends the existing blog metadata system to automatically track creation and modification times from Git history, eliminating the need for manual `time` fields in frontmatter. The implementation uses Git commands to extract file history, including commit timestamps and hashes, enabling version tracking with direct links to GitHub commits. The design maintains backward compatibility during the transition period and follows existing blog system patterns.

## Architecture

### High-Level Flow

```
MDX File (app/routes/blogs.*.mdx)
    ↓
Git History Extractor (utils/git.ts)
    ↓ [executes git log commands]
Git Commit Data (timestamps, hashes, messages)
    ↓
Post Metadata Generator (utils/post.ts)
    ↓ [merges git data with frontmatter]
PostInfo Interface (app/types/index.ts)
    ↓ [includes version history]
Blog Components (Detail Header + List)
    ↓ [renders with GitHub links]
User Interface
```

### Key Design Decisions

1. **Git as Source of Truth**: Use `git log` to extract file creation time (first commit) and modification time (last commit), eliminating manual date management

2. **Version History Tracking**: Store commit history for each post, enabling version browsing and GitHub integration

3. **GitHub Integration**: Generate GitHub commit URLs from repository configuration and commit hashes

4. **Backward Compatibility**: Support existing `time` field in frontmatter during transition, with Git data taking precedence when available

5. **Commit Filtering**: Only track meaningful commits (exclude automated formatting, typo fixes based on commit message patterns)

6. **Performance Optimization**: Cache Git data during build to avoid repeated Git command execution

## Components and Interfaces

### 1. Type System Updates

**File**: `app/types/index.ts`

Add new interfaces and extend `PostInfo`:

```typescript
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

export interface PostInfo {
  // ... existing fields
  time: string; // DEPRECATED: will be replaced by gitInfo.createdAt
  date: string; // DEPRECATED: duplicate of time
  gitInfo?: PostGitInfo; // Git-derived metadata
}
```

### 2. Git History Extraction Utility

**File**: `utils/git.ts` (new file)

Create utility functions to extract Git history:

```typescript
import { execSync } from 'child_process';
import path from 'path';

interface GitConfig {
  githubRepo?: string; // e.g., "username/repo"
  githubBranch?: string; // e.g., "main"
}

/**
 * Extract Git commit history for a specific file
 */
export async function getFileGitHistory(
  filePath: string,
  config: GitConfig = {},
): Promise<PostGitInfo | null> {
  try {
    // Get all commits for the file, newest first
    const gitLog = execSync(
      `git log --follow --format="%H|%aI|%an|%s" -- "${filePath}"`,
      { encoding: 'utf-8', cwd: process.cwd() },
    ).trim();

    if (!gitLog) {
      return null; // File not in Git history
    }

    const lines = gitLog.split('\n');
    const commits: PostCommit[] = lines
      .map((line) => {
        const [hash, date, author, message] = line.split('|');
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
      })
      .filter((commit) => {
        // Filter out noise commits
        const lowerMessage = commit.message.toLowerCase();
        return !lowerMessage.match(/^(chore|style|format|typo|fix typo)/);
      });

    if (commits.length === 0) {
      return null;
    }

    // First commit is creation, last commit is latest update
    const createdAt = commits[commits.length - 1].date;
    const updatedAt = commits[0].date;

    return {
      createdAt,
      updatedAt,
      commits,
    };
  } catch (error) {
    console.warn(`Failed to get Git history for ${filePath}:`, error);
    return null;
  }
}

/**
 * Load Git configuration from package.json or environment
 */
export function loadGitConfig(): GitConfig {
  try {
    const packageJson = require(path.join(process.cwd(), 'package.json'));
    const repoUrl = packageJson.repository?.url || packageJson.repository;

    if (repoUrl) {
      // Extract owner/repo from GitHub URL
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
```

### 3. Metadata Generation Logic

**File**: `utils/post.ts`

Modify `generatePostsMetadata` function to integrate Git history:

```typescript
import { getFileGitHistory, loadGitConfig } from './git';

export const generatePostsMetadata = async (
  postsDirectory: string,
  filePrefix: string | string[],
) => {
  const allFiles = await fs.readdir(postsDirectory, { encoding: 'utf-8' });
  const normalizedPrefix = Array.isArray(filePrefix)
    ? filePrefix
    : [filePrefix];
  const gitConfig = loadGitConfig();

  // ... existing summary file loading ...

  const filteredPosts = allFiles.filter((fileName) =>
    normalizedPrefix.some((prefix) => fileName.startsWith(prefix)),
  );

  const postMetadataList = (await Promise.all(
    filteredPosts.map(async (fileName) => {
      const fullPath = path.join(postsDirectory, fileName);
      const postContent = await fs.readFile(fullPath, 'utf8');

      // Extract Git history
      const gitInfo = await getFileGitHistory(fullPath, gitConfig);

      // ... existing unified processing ...

      // Determine publication date: Git creation time > frontmatter time
      const publicationDate =
        gitInfo?.createdAt ||
        processedFile.data.matter?.time ||
        processedFile.data.matter?.date;

      return {
        filename: baseName,
        ...processedFile.data.matter,
        readingTime: readingTime(processedFile.toString()),
        url: postUrl,
        toc: processedFile.data.toc,
        summary: postSummary,
        content: htmlContent.toString(),
        title: processedFile?.data?.matter.title ?? '',
        time: publicationDate, // For backward compatibility
        date: publicationDate, // For backward compatibility
        gitInfo, // New Git-derived data
      };
    }),
  )) as PostInfo[];

  // ... existing filtering and sorting ...

  // Sort by Git update time if available, otherwise publication date
  publishedPosts.sort((a, b) => {
    const aDate = new Date(a.gitInfo?.updatedAt || a.time);
    const bDate = new Date(b.gitInfo?.updatedAt || b.time);
    return bDate.getTime() - aDate.getTime();
  });

  return JSON.stringify(publishedPosts);
};
```

### 4. Detail Header Component

**File**: `app/features/blog/components/blog-detail/detail-header.tsx`

Add `gitInfo` prop and version history display:

```typescript
import { PostGitInfo } from '~/types';

interface BlogContentProps {
  // ... existing props
  gitInfo?: PostGitInfo;
}

export const DetailHeader = forwardRef<HTMLElement, BlogContentProps>(
  function DetailHeader({ title, summary, className, readingTime, date, tags, author, editUrl, gitInfo }, ref) {
    const { t, locale } = useTranslation();

    // Use Git creation time if available, otherwise fall back to frontmatter
    const effectiveDate = gitInfo?.createdAt || date;
    const lastModified = gitInfo?.updatedAt;

    // ... existing date parsing logic ...

    const parsedLastModified = useMemo(() => {
      if (!lastModified) return null;
      const candidate = new Date(lastModified);
      return isNaN(candidate.getTime()) ? null : candidate;
    }, [lastModified]);

    const formattedLastModified = useMemo(() => {
      if (!parsedLastModified) return null;
      return new Intl.DateTimeFormat(localeCode, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(parsedLastModified);
    }, [parsedLastModified, localeCode]);

    // Check if post was updated (more than 24 hours difference)
    const wasUpdated = useMemo(() => {
      if (!gitInfo) return false;
      const created = new Date(gitInfo.createdAt).getTime();
      const updated = new Date(gitInfo.updatedAt).getTime();
      return (updated - created) > 24 * 60 * 60 * 1000;
    }, [gitInfo]);

    return (
      <div className={cn('min-w-0 flex-1', className)}>
        <motion.article>
          {(title || summary) && (
            <header ref={ref} className="mb-10 space-y-6">
              {/* ... existing title ... */}

              {(author || effectiveDate || readingMinutes || wasUpdated) && (
                <div className="border-border/70 flex flex-col gap-4 border-b pb-6">
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    {/* ... existing author ... */}

                    {effectiveDate && (
                      <time dateTime={effectiveDate} className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" />
                        {formattedDate}
                      </time>
                    )}

                    {wasUpdated && formattedLastModified && (
                      <time dateTime={lastModified} className="inline-flex items-center gap-1.5">
                        <PencilLine className="h-4 w-4" />
                        {t('blog.detail.updated')}: {formattedLastModified}
                      </time>
                    )}

                    {/* ... existing reading time ... */}
                  </div>

                  {/* Version history dropdown */}
                  {gitInfo && gitInfo.commits.length > 1 && (
                    <details className="text-muted-foreground group text-sm">
                      <summary className="cursor-pointer list-none">
                        <span className="inline-flex items-center gap-1.5 hover:text-foreground">
                          <span className="i-lucide-git-commit-horizontal h-4 w-4" />
                          {t('blog.detail.versionHistory')} ({gitInfo.commits.length})
                          <span className="i-lucide-chevron-down h-3 w-3 transition-transform group-open:rotate-180" />
                        </span>
                      </summary>
                      <div className="mt-3 space-y-2 pl-5">
                        {gitInfo.commits.slice(0, 10).map(commit => (
                          <div key={commit.hash} className="flex items-start gap-2 text-xs">
                            <code className="text-muted-foreground/70 font-mono">{commit.hash}</code>
                            <div className="flex-1">
                              <div className="text-foreground">{commit.message}</div>
                              <div className="text-muted-foreground/70">
                                {commit.author} · {new Date(commit.date).toLocaleDateString(localeCode)}
                              </div>
                            </div>
                            {commit.githubUrl && (
                              <a
                                href={commit.githubUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-foreground"
                              >
                                <span className="i-lucide-external-link h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* ... existing tags and summary ... */}
            </header>
          )}
          {/* ... rest of component ... */}
        </motion.article>
      </div>
    );
  }
);
```

### 5. List Component

**File**: `app/features/blog/components/blog-list/list.tsx`

Add update indicator:

```typescript
export default function List({ list }: BaseBlogListProps) {
  const { t, locale } = useTranslation();
  const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';

  return (
    <div className="mx-auto max-w-4xl px-4 pt-[60px] sm:px-6 sm:pt-[100px]">
      <div className="grid gap-6 md:gap-8">
        {list.map((li, index) => {
          const wasUpdated = li.gitInfo &&
            (new Date(li.gitInfo.updatedAt).getTime() -
             new Date(li.gitInfo.createdAt).getTime()) > 24 * 60 * 60 * 1000;

          return (
            <motion.div key={li.filename} /* ... existing animation props ... */>
              <Link to={li.url} className={/* ... existing classes ... */}>
                <h3 className="mb-2 text-2xl font-medium">{li.title}</h3>
                <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                  <Time time={li.gitInfo?.createdAt || li.time} />

                  {wasUpdated && (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="i-lucide-pencil-line h-3 w-3" />
                      {t('blog.list.updated')}
                    </span>
                  )}

                  {/* ... existing tags ... */}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
```

## Data Models

### Complete PostInfo with Git Integration

```typescript
export interface PostInfo {
  title: string;
  tags: string[];
  summary: string;
  time: string; // Publication date (from Git or frontmatter)
  readingTime: ReadTimeResults;
  filename: string;
  url: string;
  toc: TocItem[];
  date: string; // Duplicate of time for compatibility
  content: string;
  status?: PostStatus;
  author?: string;
  gitInfo?: PostGitInfo; // Git-derived metadata and version history
}

export interface PostGitInfo {
  createdAt: string; // ISO 8601 timestamp of first commit
  updatedAt: string; // ISO 8601 timestamp of last commit
  commits: PostCommit[]; // Full version history
}

export interface PostCommit {
  hash: string; // Short commit hash
  date: string; // ISO 8601 timestamp
  message: string; // Commit message
  author: string; // Commit author
  githubUrl?: string; // GitHub commit URL
}
```

### Frontmatter Schema (Simplified)

With Git integration, frontmatter becomes minimal:

```yaml
---
title: 'My Blog Post'
tags: ['tech', 'tutorial']
status: 'ready'
author: 'John Doe'
# time/date fields are now optional - Git provides these automatically
---
```

## Error Handling

### Git Command Failures

- **Scenario**: `git log` command fails or file not in Git history
- **Handling**: Return `null` from `getFileGitHistory`, fall back to frontmatter dates
- **Logging**: Warn in console but continue build process

### Missing Repository Configuration

- **Scenario**: Cannot extract GitHub repo from package.json
- **Handling**: Generate commit data without GitHub URLs
- **Impact**: Version history displays without external links

### Invalid Commit Data

- **Scenario**: Git log output is malformed or unparseable
- **Handling**: Skip problematic commits, use remaining valid commits
- **Validation**: Check date parsing with `isNaN(new Date(date).getTime())`

### No Commits Found After Filtering

- **Scenario**: All commits filtered out as noise (formatting, typos)
- **Handling**: Return `null` gitInfo, fall back to frontmatter or file system dates

## Testing Strategy

### Unit Tests

1. **Git History Extraction**
   - Test `getFileGitHistory` with mock Git output
   - Test commit filtering logic
   - Test GitHub URL generation
   - Test error handling for missing files

2. **Metadata Generation**
   - Test Git data integration with frontmatter
   - Test fallback to frontmatter dates
   - Test sorting by update time

3. **Component Rendering**
   - Test Detail Header with/without gitInfo
   - Test version history dropdown
   - Test GitHub link generation
   - Test update indicator in list view

### Integration Tests

1. **Build Process**
   - Verify Git commands execute during build
   - Test virtual module includes gitInfo
   - Verify hot reload with Git data

2. **Git Integration**
   - Test with real Git repository
   - Verify commit history accuracy
   - Test with files having multiple commits

### Manual Testing

1. Create test blog post and commit multiple times
2. Verify creation date matches first commit
3. Verify update date matches last commit
4. Test version history dropdown displays all commits
5. Verify GitHub links navigate to correct commits
6. Test with posts having no Git history (fallback)
7. Verify locale-specific date formatting

## Implementation Notes

### Locale Support

Add new translation keys:

```typescript
// en locale
{
  "blog.detail.updated": "Updated",
  "blog.detail.versionHistory": "Edit History",
  "blog.list.updated": "Updated"
}

// zh locale
{
  "blog.detail.updated": "更新于",
  "blog.detail.versionHistory": "编辑历史",
  "blog.list.updated": "已更新"
}
```

### Performance Considerations

- Git commands run during build time, not runtime
- Use `execSync` for simplicity (build is already async)
- Consider caching Git data in a JSON file for faster rebuilds
- Limit version history display to 10 most recent commits

### Migration Path

1. **Phase 1**: Add Git integration alongside existing frontmatter dates
2. **Phase 2**: Update components to prefer Git data over frontmatter
3. **Phase 3**: Remove `time` fields from frontmatter in existing posts
4. **Phase 4**: Mark `time`/`date` fields as deprecated in types

### Security Considerations

- Sanitize commit messages before rendering (XSS prevention)
- Validate GitHub URLs match expected pattern
- Use `rel="noreferrer"` on external GitHub links
- Limit commit history depth to prevent excessive data

### Backward Compatibility

- Existing posts with `time` field continue to work
- Git data takes precedence when available
- Components gracefully handle missing `gitInfo`
- No breaking changes to existing `PostInfo` consumers

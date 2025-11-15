# Requirements Document

## Introduction

This feature adds automatic creation and modification time tracking to blog posts using Git history, along with version history display and GitHub integration. The system will extract timestamps from Git commits, eliminating the need for manual date management in frontmatter, and provide readers with a complete version history linked to GitHub commits.

## Glossary

- **Blog System**: The content management system that processes MDX blog posts and generates metadata
- **Post Metadata Generator**: The `generatePostsMetadata` function in `utils/post.ts` that extracts frontmatter and file information
- **Git History Extractor**: New utility in `utils/git.ts` that executes Git commands to extract file commit history
- **PostInfo Interface**: TypeScript interface in `app/types/index.ts` defining blog post metadata structure
- **Detail Header Component**: React component at `app/features/blog/components/blog-detail/detail-header.tsx` displaying post metadata
- **List Component**: React component at `app/features/blog/components/blog-list/list.tsx` showing blog post summaries
- **MDX File**: Markdown file with JSX support stored in `app/routes/` with `blogs.*.mdx` naming pattern
- **Git Commit**: A version control commit containing timestamp, author, message, and hash
- **GitHub Commit URL**: Direct link to a commit on GitHub in format `https://github.com/{owner}/{repo}/commit/{hash}`
- **Version History**: Chronological list of all meaningful commits affecting a blog post

## Requirements

### Requirement 1

**User Story:** As a blog author, I want blog post creation and modification times to be automatically extracted from Git history, so that I don't need to manually maintain date fields in frontmatter

#### Acceptance Criteria

1. WHEN the Post Metadata Generator processes an MDX File, the Git History Extractor SHALL execute `git log` to retrieve all commits affecting that file
2. THE Git History Extractor SHALL extract the timestamp of the first commit as the creation time
3. THE Git History Extractor SHALL extract the timestamp of the most recent commit as the modification time
4. WHEN an MDX File contains a `time` or `date` field in frontmatter, the Blog System SHALL use Git-derived creation time in preference to the frontmatter value
5. WHEN Git history is unavailable for an MDX File, the Blog System SHALL fall back to frontmatter `time` or `date` fields

### Requirement 2

**User Story:** As a blog reader, I want to see when a blog post was created and last modified, so that I can assess the recency and relevance of the content

#### Acceptance Criteria

1. THE Detail Header Component SHALL display the creation date extracted from Git history or frontmatter
2. WHEN the modification time differs from creation time by more than 24 hours, the Detail Header Component SHALL display the modification date
3. THE Detail Header Component SHALL format both dates using locale-aware formatting matching the user's language preference
4. THE Detail Header Component SHALL use distinct icons to differentiate creation date (CalendarDays) from modification date (PencilLine)
5. WHEN modification time is within 24 hours of creation time, the Detail Header Component SHALL display only the creation date

### Requirement 3

**User Story:** As a blog reader, I want to see a complete version history of blog posts, so that I can understand how the content has evolved over time

#### Acceptance Criteria

1. THE Git History Extractor SHALL extract commit hash, timestamp, author name, and commit message for each commit
2. THE Git History Extractor SHALL filter out commits with messages matching patterns `^(chore|style|format|typo|fix typo)` to exclude noise
3. THE Detail Header Component SHALL display a collapsible version history section when more than one commit exists
4. THE Detail Header Component SHALL show the 10 most recent commits in the version history
5. THE Detail Header Component SHALL display each commit with its short hash (7 characters), message, author, and formatted date

### Requirement 4

**User Story:** As a blog reader, I want to click on version history entries to view the exact changes on GitHub, so that I can see detailed diffs and commit context

#### Acceptance Criteria

1. THE Git History Extractor SHALL generate GitHub commit URLs in format `https://github.com/{owner}/{repo}/commit/{hash}`
2. THE Git History Extractor SHALL extract repository owner and name from `package.json` repository field
3. WHEN a GitHub repository is configured, the Detail Header Component SHALL display external link icons next to each commit in version history
4. WHEN a user clicks a commit's external link icon, the Blog System SHALL open the GitHub commit page in a new tab
5. WHEN no GitHub repository is configured, the Detail Header Component SHALL display version history without external links

### Requirement 5

**User Story:** As a blog reader browsing the blog list, I want to see which posts have been recently updated, so that I can prioritize reading content with new information

#### Acceptance Criteria

1. WHEN a blog post's modification time differs from creation time by more than 24 hours, the List Component SHALL display an "Updated" indicator
2. THE List Component SHALL use a distinct icon (PencilLine) for the update indicator
3. THE List Component SHALL position the update indicator after the creation date in the metadata row
4. WHEN a blog post has not been updated, the List Component SHALL display only the creation date
5. THE Blog System SHALL sort blog posts by modification time (most recently updated first) when Git history is available

### Requirement 6

**User Story:** As a blog author, I want the system to handle Git command failures gracefully, so that the build process doesn't break when Git history is unavailable

#### Acceptance Criteria

1. WHEN the `git log` command fails, the Git History Extractor SHALL return null and log a warning
2. WHEN Git history returns null, the Post Metadata Generator SHALL use frontmatter dates as fallback
3. WHEN no Git history or frontmatter dates exist, the Post Metadata Generator SHALL use file system modification time
4. THE Blog System SHALL complete the build process successfully even when Git commands fail for some files
5. WHEN Git history extraction fails, the Blog System SHALL log the file path and error message for debugging

### Requirement 7

**User Story:** As a blog author, I want to control which commits appear in version history, so that minor formatting changes don't clutter the history

#### Acceptance Criteria

1. THE Git History Extractor SHALL exclude commits with messages starting with `chore:`, `style:`, `format:`, or `typo:`
2. THE Git History Extractor SHALL exclude commits with messages matching `fix typo` (case-insensitive)
3. WHEN all commits are filtered out, the Git History Extractor SHALL return null
4. THE Git History Extractor SHALL preserve commit order (newest first) after filtering
5. THE Git History Extractor SHALL include at least the most recent commit even if it matches filter patterns

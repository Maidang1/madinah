# Implementation Plan

- [x] 1. Create Git history extraction utility
  - Create `utils/git.ts` with functions to extract commit history from Git
  - Implement `getFileGitHistory()` to execute `git log` and parse commit data
  - Implement `loadGitConfig()` to extract GitHub repository info from package.json
  - Add commit filtering logic to exclude noise commits (chore, style, typo, etc.)
  - Generate GitHub commit URLs from repository config and commit hashes
  - Add error handling for Git command failures
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 4.1, 4.2, 6.1, 7.1, 7.2, 7.3_

- [x] 2. Update type definitions for Git integration
  - Add `PostCommit` interface to `app/types/index.ts` with hash, date, message, author, githubUrl fields
  - Add `PostGitInfo` interface with createdAt, updatedAt, and commits array
  - Extend `PostInfo` interface to include optional `gitInfo` field
  - Add JSDoc comments explaining the new types
  - _Requirements: 1.1, 3.1, 4.1_

- [x] 3. Integrate Git history into metadata generation
  - Import Git utilities into `utils/post.ts`
  - Call `loadGitConfig()` once at the start of `generatePostsMetadata()`
  - Call `getFileGitHistory()` for each blog post file
  - Merge Git data with frontmatter in the post metadata object
  - Use Git creation time as primary source, fall back to frontmatter `time`/`date`
  - Update sorting logic to use Git update time when available
  - Add error handling to continue build if Git extraction fails for individual files
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.5, 6.2, 6.3, 6.4, 6.5_

- [-] 4. Update Detail Header component to display Git metadata
- [x] 4.1 Add gitInfo prop to DetailHeader component interface
  - Update `BlogContentProps` interface to include `gitInfo?: PostGitInfo`
  - _Requirements: 2.1_

- [x] 4.2 Implement creation and modification date display
  - Use `gitInfo.createdAt` as primary creation date, fall back to `date` prop
  - Calculate if post was updated (>24 hours difference between created and updated)
  - Format modification date using existing locale-aware date formatting
  - Display modification date with PencilLine icon when post was updated
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4.3 Implement version history dropdown
  - Create collapsible `<details>` element for version history
  - Display commit count in the summary line
  - Render list of up to 10 most recent commits
  - Show commit hash, message, author, and formatted date for each commit
  - Add external link icon with GitHub URL for each commit when available
  - Style the dropdown to match existing design system
  - _Requirements: 3.3, 3.4, 3.5, 4.3, 4.4, 4.5_

- [x] 5. Update List component to show update indicators
  - Import `useTranslation` hook for locale support
  - Calculate `wasUpdated` flag for each post (>24 hours difference)
  - Display "Updated" indicator with PencilLine icon when post was updated
  - Position update indicator after creation date in metadata row
  - Ensure consistent spacing whether or not update indicator is present
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. Add internationalization support
  - Add translation keys to English locale: `blog.detail.updated`, `blog.detail.versionHistory`, `blog.list.updated`
  - Add translation keys to Chinese locale with appropriate translations
  - Verify translations display correctly in both locales
  - _Requirements: 2.3, 5.2_

- [ ]\* 7. Add error handling and logging
  - Add console warnings when Git commands fail
  - Log file paths when Git history extraction fails
  - Verify build completes successfully when Git is unavailable
  - Test fallback to frontmatter dates when Git fails
  - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [ ]\* 8. Test Git integration with real repository
  - Create test blog post and make multiple commits
  - Verify creation date matches first commit timestamp
  - Verify modification date matches last commit timestamp
  - Verify version history displays all non-filtered commits
  - Test GitHub links navigate to correct commit pages
  - Test with posts having no Git history (new files)
  - Verify commit filtering excludes chore/style/typo commits
  - _Requirements: 1.2, 1.3, 3.2, 4.4, 7.1, 7.2, 7.4_

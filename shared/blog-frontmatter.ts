export const BLOG_POST_STATUS_OPTIONS = ["draft", "published", "archived", "WIP"] as const;

export type BlogPostStatus = (typeof BLOG_POST_STATUS_OPTIONS)[number];

export const PUBLISHED_BLOG_POST_STATUS = "published" satisfies BlogPostStatus;

export function isPublishedBlogPostStatus(status: BlogPostStatus): boolean {
  return status === PUBLISHED_BLOG_POST_STATUS;
}

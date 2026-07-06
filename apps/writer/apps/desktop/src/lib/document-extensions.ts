export const MARKDOWN_DOCUMENT_EXTENSIONS = ["md", "mdx", "markdown"] as const;

export function isMarkdownDocumentExtension(extension: string): boolean {
  return MARKDOWN_DOCUMENT_EXTENSIONS.some(
    (candidate) => candidate.toLowerCase() === extension.toLowerCase(),
  );
}

export function stripMarkdownDocumentExtension(path: string): string {
  const lower = path.toLowerCase();
  for (const extension of MARKDOWN_DOCUMENT_EXTENSIONS) {
    const suffix = `.${extension}`;
    if (lower.endsWith(suffix)) return path.slice(0, -suffix.length);
  }
  return path;
}

export function hasMarkdownDocumentExtension(path: string): boolean {
  const lastDot = path.lastIndexOf(".");
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (lastDot <= lastSlash + 1) return false;
  return isMarkdownDocumentExtension(path.slice(lastDot + 1));
}

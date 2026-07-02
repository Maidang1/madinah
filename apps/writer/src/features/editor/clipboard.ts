// Clipboard helper logic is parked while paste handling returns to MDXEditor.
// export interface MarkdownClipboardData {
//   getData(type: string): string;
// }
//
// const MARKDOWN_CLIPBOARD_TYPES = ["text/markdown", "text/x-markdown", "text/plain"];
//
// export interface PasteClipboardData extends MarkdownClipboardData {
//   types?: readonly string[] | null;
//   files?: ArrayLike<File> | null;
// }
//
// export function getImageFilesFromClipboardData(
//   clipboardData: PasteClipboardData | null,
// ): File[] {
//   const files = clipboardData?.files;
//   if (!files) return [];
//
//   return Array.from(files).filter((file) => file.type.startsWith("image/"));
// }
//
// export function getMarkdownTextFromClipboardData(
//   clipboardData: MarkdownClipboardData | null,
// ): string | null {
//   if (!clipboardData) return null;
//
//   for (const type of MARKDOWN_CLIPBOARD_TYPES) {
//     const value = clipboardData.getData(type);
//     if (value.trim()) {
//       return value;
//     }
//   }
//
//   return null;
// }

export {};

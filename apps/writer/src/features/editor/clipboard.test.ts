import { describe, it } from "vitest";

describe.skip("editor clipboard helpers", () => {
  it("is parked while paste handling stays with MDXEditor", () => {});
});

// Clipboard helper tests are parked with the helper implementation.
// import { describe, expect, it } from "vitest";
// import {
//   getImageFilesFromClipboardData,
//   getMarkdownTextFromClipboardData,
// } from "./clipboard";
//
// describe("editor clipboard helpers", () => {
//   it("prefers markdown clipboard text over plain text", () => {
//     const clipboard = createClipboardData({
//       "text/markdown": "# Pasted\n\n- item",
//       "text/plain": "plain fallback",
//     });
//
//     expect(getMarkdownTextFromClipboardData(clipboard)).toBe("# Pasted\n\n- item");
//   });
//
//   it("uses plain text when markdown data is absent", () => {
//     const clipboard = createClipboardData({
//       "text/plain": "## Raw markdown\n\nBody",
//     });
//
//     expect(getMarkdownTextFromClipboardData(clipboard)).toBe(
//       "## Raw markdown\n\nBody",
//     );
//   });
//
//   it("ignores empty clipboard text", () => {
//     const clipboard = createClipboardData({
//       "text/markdown": "   \n",
//       "text/plain": "",
//     });
//
//     expect(getMarkdownTextFromClipboardData(clipboard)).toBeNull();
//   });
// });
//
// describe("getImageFilesFromClipboardData", () => {
//   it("returns only image files from the clipboard", () => {
//     const png = createFile("shot.png", "image/png");
//     const text = createFile("notes.txt", "text/plain");
//
//     expect(
//       getImageFilesFromClipboardData({
//         getData: () => "",
//         files: [png, text],
//       }),
//     ).toEqual([png]);
//   });
//
//   it("returns an empty list when there are no image files", () => {
//     expect(
//       getImageFilesFromClipboardData({
//         getData: () => "hello",
//         files: [createFile("notes.txt", "text/plain")],
//       }),
//     ).toEqual([]);
//   });
//
//   it("handles clipboard data without files", () => {
//     expect(
//       getImageFilesFromClipboardData({ getData: () => "hello", files: null }),
//     ).toEqual([]);
//     expect(getImageFilesFromClipboardData(null)).toEqual([]);
//   });
// });
//
// function createFile(name: string, type: string): File {
//   return new File(["x"], name, { type });
// }
//
// function createClipboardData(values: Record<string, string>) {
//   return {
//     getData: (type: string) => values[type] ?? "",
//   };
// }

export {};

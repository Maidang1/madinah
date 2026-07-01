import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TreeApi } from "react-arborist";
import { FileTreeSidebar } from "./FileTreeSidebar";
import type { FileTreeNode } from "./file-tree";

describe("FileTreeSidebar", () => {
  const baseProps = {
    activeFileState: {
      filePath: null,
      isDirty: false,
      draftStatus: "idle" as const,
    },
    activePath: null,
    activeDocumentId: null,
    drafts: [],
    expandedPaths: new Set<string>(),
    isAvailable: true,
    publishTargetLabel: null,
    status: "Open a folder",
    treeRef: createRef<TreeApi<FileTreeNode> | null>(),
    onAction: () => {},
    onDraftAction: () => {},
    onNewDocument: () => {},
    onNewFile: () => {},
    onNewFolder: () => {},
    onOpenDraft: () => {},
    onOpenFile: () => {},
    onOpenFolder: () => {},
    onRefresh: () => {},
    onRename: () => {},
    onToggleDirectory: () => {},
  };

  it("renders empty workspace actions", () => {
    const html = renderToStaticMarkup(
      <FileTreeSidebar
        {...baseProps}
        nodes={[]}
        roots={[]}
      />,
    );

    expect(html).toContain("Open Folder");
    expect(html).toContain("New Document");
  });

  it("renders a full-width scroll list for workspace files", () => {
    const nodes: FileTreeNode[] = [
      {
        path: "/workspace/blogs",
        name: "blogs",
        kind: "directory",
        childrenCount: 1,
        isRoot: true,
        children: [
          {
            path: "/workspace/blogs/hello.mdx",
            name: "hello.mdx",
            kind: "file",
            childrenCount: 0,
            children: [],
          },
        ],
      },
    ];

    const html = renderToStaticMarkup(
      <FileTreeSidebar {...baseProps} nodes={nodes} roots={["/workspace"]} />,
    );

    expect(html).toContain("file-tree-list");
    expect(html).toContain("file-tree-list-row");
  });
});

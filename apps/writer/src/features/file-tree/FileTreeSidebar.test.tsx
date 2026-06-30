import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TreeApi } from "react-arborist";
import { FileTreeSidebar } from "./FileTreeSidebar";
import type { FileTreeNode } from "./file-tree";

describe("FileTreeSidebar", () => {
  it("renders empty workspace actions", () => {
    const html = renderToStaticMarkup(
      <FileTreeSidebar
        activeFileState={{
          filePath: null,
          isDirty: false,
          draftStatus: "idle",
        }}
        activePath={null}
        activeDocumentId={null}
        drafts={[]}
        expandedPaths={new Set()}
        isAvailable
        nodes={[]}
        publishTargetLabel={null}
        roots={[]}
        status="Open a folder"
        treeRef={createRef<TreeApi<FileTreeNode> | null>()}
        onAction={() => {}}
        onDraftAction={() => {}}
        onNewDocument={() => {}}
        onNewFile={() => {}}
        onNewFolder={() => {}}
        onOpenDraft={() => {}}
        onOpenFile={() => {}}
        onOpenFolder={() => {}}
        onRefresh={() => {}}
        onRename={() => {}}
        onToggleDirectory={() => {}}
      />,
    );

    expect(html).toContain("Open Folder");
    expect(html).toContain("New Document");
  });
});

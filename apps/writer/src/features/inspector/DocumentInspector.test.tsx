import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AiDocumentReviewState } from "../../domain/ai-polish";
import type { MarkdownDocument } from "../../domain/document";
import { DocumentInspector } from "./DocumentInspector";

describe("DocumentInspector", () => {
  it("renders AI review results in the review tab", () => {
    const markup = renderInspector({
      status: "ready",
      message: "Reviewed with Codex",
      updatedAt: "2026-07-04T08:00:00.000Z",
      review: {
        summary: "Clear structure with one weak section.",
        issues: [
          {
            severity: "warning",
            title: "Weak opening",
            detail: "The first paragraph is vague.",
            suggestion: "Start with the concrete claim.",
          },
        ],
      },
    });

    expect(markup).toContain("AI Review");
    expect(markup).toContain("Clear structure with one weak section.");
    expect(markup).toContain("Weak opening");
    expect(markup).toContain("Start with the concrete claim.");
    expect(markup).toContain("is-warning");
  });

  it("renders AI review loading state", () => {
    const markup = renderInspector({
      status: "loading",
      message: "Reviewing with Codex",
      review: null,
      updatedAt: null,
    });

    expect(markup).toContain("Running");
    expect(markup).toContain("Reviewing with Codex");
  });

  it("renders AI review error state", () => {
    const markup = renderInspector({
      status: "error",
      message: "Agent returned invalid review JSON",
      review: null,
      updatedAt: null,
    });

    expect(markup).toContain("inspector-error-state");
    expect(markup).toContain("Agent returned invalid review JSON");
  });
});

function renderInspector(aiReviewState: AiDocumentReviewState) {
  return renderToStaticMarkup(
    <DocumentInspector
      document={documentFixture}
      metrics={{
        characters: 100,
        blocks: 2,
        headings: 1,
        images: 0,
        links: 0,
        readingMinutes: 1,
        words: 20,
      }}
      versions={[]}
      aiReviewState={aiReviewState}
      profileName="GFM"
      pluginDiagnostics={[]}
      workspace={null}
      activeTab="review"
      onTabChange={() => {}}
      onMetadataChange={() => {}}
      onOutlineJump={() => {}}
      onRunAiReview={() => {}}
      onSaveVersion={() => {}}
      onRestoreVersion={() => {}}
    />,
  );
}

const documentFixture: MarkdownDocument = {
  id: "doc-1",
  slug: "draft",
  title: "Draft",
  description: "",
  author: "Madinah",
  tags: [],
  status: "draft",
  pubDate: "2026-07-04",
  body: "# Draft\n\nBody",
  createdAt: "2026-07-04T07:00:00.000Z",
  updatedAt: "2026-07-04T07:00:00.000Z",
};

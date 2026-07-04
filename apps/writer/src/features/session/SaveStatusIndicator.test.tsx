import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MarkdownDocument } from "../../domain/document";
import { SaveStatusIndicator, deriveSaveStatus } from "./SaveStatusIndicator";

const document: MarkdownDocument = {
  id: "doc-1",
  slug: "doc-1",
  title: "Doc",
  description: "",
  author: "Madinah",
  tags: [],
  status: "draft",
  pubDate: "2026-07-04 00:00:00",
  body: "# Doc",
  createdAt: "2026-07-04T00:00:00.000Z",
  updatedAt: "2026-07-04T00:00:00.000Z",
};

describe("SaveStatusIndicator", () => {
  it("derives compact save states from the session", () => {
    expect(
      deriveSaveStatus({ document, isDirty: true, error: null }, "Saved"),
    ).toMatchObject({ kind: "dirty", label: "未保存" });
    expect(
      deriveSaveStatus({ document, isDirty: false, error: null }, "Saving"),
    ).toMatchObject({ kind: "saving", label: "正在保存" });
    expect(
      deriveSaveStatus({ document, isDirty: false, error: null }, "Saved"),
    ).toMatchObject({ kind: "saved", label: "已保存" });
  });

  it("keeps a stable icon shell while preserving accessible labels", () => {
    const html = renderToStaticMarkup(
      <SaveStatusIndicator
        session={{ document, isDirty: true, error: null }}
        status="Unsaved changes"
      />,
    );

    expect(html).toContain('class="save-status-indicator"');
    expect(html).toContain('data-kind="dirty"');
    expect(html).toContain('class="save-status-indicator-chip"');
    expect(html).toContain('aria-label="未保存"');
    expect(html).toContain('class="save-status-indicator-label"');
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";
import {
  renderPreviewContent,
  renderPreviewError,
  renderPreviewLoading,
} from "./PreviewPane";

describe("feature preview pane", () => {
  it("renders compiled content with profile preview components", async () => {
    const components: Record<string, ComponentType<any>> = {
      Callout: ({ children }: { children?: React.ReactNode }) => (
        <aside data-plugin-callout="true">{children}</aside>
      ),
    };

    const html = renderToStaticMarkup(
      renderPreviewContent(
        ({ components: componentMap }) => {
          const Callout = componentMap?.Callout ?? "div";
          return <Callout>Plugin preview</Callout>;
        },
        components,
      ),
    );

    expect(html).toContain('data-plugin-callout="true"');
    expect(html).toContain("Plugin preview");
  });

  it("renders compile errors inside the preview content surface", () => {
    const html = renderToStaticMarkup(renderPreviewError("Unexpected token"));

    expect(html).toContain('class="preview-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Unexpected token");
  });

  it("renders a preview loading state", () => {
    const html = renderToStaticMarkup(renderPreviewLoading());

    expect(html).toContain("preview-loading");
    expect(html).toContain("Compiling preview");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EMPTY_AI_OPERATION_STATE } from "../../domain/ai-polish";
import { AiOperationBanner } from "./AiOperationBanner";

describe("AiOperationBanner", () => {
  it("renders nothing when idle", () => {
    expect(
      renderToStaticMarkup(
        createElement(AiOperationBanner, {
          state: EMPTY_AI_OPERATION_STATE,
        }),
      ),
    ).toBe("");
  });

  it("renders running state as a polite status", () => {
    const markup = renderToStaticMarkup(
      createElement(AiOperationBanner, {
        state: {
          status: "running",
          commandId: "ai.polish.document",
          label: "Polishing document",
          detail: "Codex is rewriting the document",
        },
      }),
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('data-command-id="ai.polish.document"');
    expect(markup).toContain("Polishing document");
    expect(markup).toContain("Codex is rewriting the document");
  });

  it("renders errors as alerts", () => {
    const markup = renderToStaticMarkup(
      createElement(AiOperationBanner, {
        state: {
          status: "error",
          commandId: "ai.polish.document",
          label: "Polishing document",
          detail: "Agent returned empty content",
        },
      }),
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Agent returned empty content");
  });
});

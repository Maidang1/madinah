import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PluginDiagnostics } from "./PluginDiagnostics";

describe("PluginDiagnostics", () => {
  it("shows a healthy workspace extension state", () => {
    const markup = renderToStaticMarkup(
      <PluginDiagnostics
        workspace={{
          root: "/workspace/blog",
          profile: "gfm",
          plugins: ["plugin.good"],
        }}
        diagnostics={[]}
      />,
    );

    expect(markup).toContain("Workspace Extensions");
    expect(markup).toContain("Workspace extensions healthy");
    expect(markup).toContain("/workspace/blog");
  });

  it("lists plugin diagnostics with severity and message", () => {
    const markup = renderToStaticMarkup(
      <PluginDiagnostics
        workspace={{
          root: "/workspace/blog",
          profile: "gfm",
          plugins: ["plugin.bad"],
        }}
        diagnostics={[
          {
            pluginId: "plugin.bad",
            severity: "error",
            message: "broken activate",
          },
        ]}
      />,
    );

    expect(markup).toContain("plugin.bad");
    expect(markup).toContain("error");
    expect(markup).toContain("broken activate");
  });
});

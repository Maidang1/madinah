import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  EngineProfile,
  PluginContext,
  WriterPlugin,
} from "../../domain/engine";
import { compileMdxPreview } from "../../lib/mdx-preview";
import { ExtensionHost } from "./ExtensionHost";

describe("workspace plugin integration", () => {
  it("activates parser, preview, language, and registered command contributions", async () => {
    const host = new ExtensionHost({
      baseProfiles: [baseProfile],
      baseProfileId: "gfm",
    });
    const plugin: WriterPlugin = {
      id: "plugin.badge",
      name: "Badge Plugin",
      version: "1.0.0",
      activate: (ctx) => {
        ctx.commands.register({
          id: "plugin.badge.insert",
          label: "Insert badge",
          run: () => undefined,
        });

        return {
          remarkPlugins: [remarkTokenTransform],
          previewComponents: {
            Badge: ({ label }: { label: string }) => (
              <span data-plugin-badge="true">{label}</span>
            ),
          },
          codeLanguages: [{ id: "mermaid", label: "Mermaid" }],
        };
      },
    };

    const result = await host.activatePlugins([plugin], pluginContext);
    const Content = await compileMdxPreview("plugin-token\n\n<Badge label=\"OK\" />", {
      profile: result.profile,
    });
    const html = renderToStaticMarkup(
      <Content components={result.profile.previewComponents} />,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.profile.commands?.map((command) => command.id)).toContain(
      "plugin.badge.insert",
    );
    expect(result.profile.codeLanguages?.map((language) => language.id)).toContain(
      "mermaid",
    );
    expect(html).toContain("PLUGIN-TOKEN");
    expect(html).toContain('data-plugin-badge="true"');
  });
});

const baseProfile: EngineProfile = {
  id: "gfm",
  name: "GitHub Flavored Markdown",
};

const pluginContext: PluginContext = {
  workspace: {
    root: "/tmp/project",
    profile: "gfm",
    plugins: ["plugin.badge"],
  },
  commands: {
    register: () => undefined,
  },
};

function remarkTokenTransform() {
  return (tree: AstNode) => {
    visitText(tree, (node) => {
      node.value = node.value.replaceAll("plugin-token", "PLUGIN-TOKEN");
    });
  };
}

interface TextNode {
  type: "text";
  value: string;
}

interface ParentNode {
  type?: string;
  children?: AstNode[];
}

type AstNode = ParentNode | TextNode;

function visitText(node: AstNode, visitor: (node: TextNode) => void) {
  if (isTextNode(node)) {
    visitor(node);
    return;
  }

  for (const child of node.children ?? []) {
    visitText(child, visitor);
  }
}

function isTextNode(node: AstNode): node is TextNode {
  return node.type === "text" && "value" in node;
}

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mdxComponents } from "../components/mdx-components";
import { compileMdxPreview } from "./mdx-preview";

describe("MDX preview compiler", () => {
  it("renders current blog MDX features with the preview component map", async () => {
    const Content = await compileMdxPreview(`
## Hello \`MDX\`

<Callout title="Note">Useful context.</Callout>

| A | B |
| - | - |
| 1 | 2 |

\`\`\`ts
const answer = 42;
\`\`\`
`);

    const html = renderToStaticMarkup(<Content components={mdxComponents} />);

    expect(html).toContain('id="hello-mdx"');
    expect(html).toContain('class="header-anchor"');
    expect(html).toContain('class="table-wrapper"');
    expect(html).toContain("Useful context.");
    expect(html).toContain("const");
    expect(html).toContain("--shiki-light");
  });
});

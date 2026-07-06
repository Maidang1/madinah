import type { SyntaxNode } from "@lezer/common";
import {
  GFM,
  parser as markdownParser,
  type InlineContext,
  type MarkdownConfig,
} from "@lezer/markdown";
import * as emoji from "node-emoji";
import { prosemarkMarkdownSyntaxExtensions } from "@/lib/prosemark-core/markdown";
import { parseWikiLink } from "@/lib/wiki-links";

export type MarkdownInlineNode =
  | { type: "text"; text: string }
  | { type: "break" }
  | {
      type: "element";
      tag: "strong" | "em" | "code" | "s" | "span";
      className?: string;
      href?: string;
      wikiTarget?: string;
      children: MarkdownInlineNode[];
    };

const wikiLinkMarkdownSyntaxExtension: MarkdownConfig = {
  defineNodes: ["WikiLink", "WikiLinkMark"],
  parseInline: [
    {
      name: "WikiLink",
      before: "Link",
      parse: (cx: InlineContext, next: number, pos: number): number => {
        if (next !== 91 /* [ */ || cx.char(pos + 1) !== 91 /* [ */) return -1;

        for (let end = pos + 2; end < cx.end - 1; end++) {
          if (cx.char(end) === 92 /* \ */) {
            end++;
            continue;
          }
          if (cx.char(end) !== 93 /* ] */ || cx.char(end + 1) !== 93 /* ] */) continue;

          return cx.addElement(
            cx.elt("WikiLink", pos, end + 2, [
              cx.elt("WikiLinkMark", pos, pos + 2),
              cx.elt("WikiLinkMark", end, end + 2),
            ]),
          );
        }

        return -1;
      },
    },
  ],
};

const inlineMarkdownParser = markdownParser.configure([
  GFM,
  prosemarkMarkdownSyntaxExtensions,
  wikiLinkMarkdownSyntaxExtension,
]);

const defaultHiddenMarkdownMarks = new Set([
  "CodeMark",
  "EmphasisMark",
  "EscapeMark",
  "LinkMark",
  "StrikethroughMark",
]);
const linkHiddenMarkdownNodes = new Set([
  ...defaultHiddenMarkdownMarks,
  "LinkLabel",
  "LinkTitle",
  "URL",
]);

function pushText(nodes: MarkdownInlineNode[], text: string) {
  if (!text) return;
  const last = nodes[nodes.length - 1];
  if (last?.type === "text") {
    last.text += text;
    return;
  }
  nodes.push({ type: "text", text });
}

function pushNodes(nodes: MarkdownInlineNode[], next: MarkdownInlineNode[]) {
  for (const node of next) {
    if (node.type === "text") {
      pushText(nodes, node.text);
    } else {
      nodes.push(node);
    }
  }
}

function decodeMarkdownEntity(entity: string): string {
  const fromCodePoint = (codePoint: number): string =>
    Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity;

  if (entity.startsWith("&#x") || entity.startsWith("&#X")) {
    return fromCodePoint(Number.parseInt(entity.slice(3, -1), 16));
  }
  if (entity.startsWith("&#")) {
    return fromCodePoint(Number.parseInt(entity.slice(2, -1), 10));
  }

  switch (entity) {
    case "&amp;":
      return "&";
    case "&apos;":
      return "'";
    case "&gt;":
      return ">";
    case "&lt;":
      return "<";
    case "&nbsp;":
      return "\u00a0";
    case "&quot;":
      return '"';
    default:
      return entity;
  }
}

function renderMarkdownChildren(
  markdown: string,
  node: SyntaxNode,
  hiddenNames = defaultHiddenMarkdownMarks,
): MarkdownInlineNode[] {
  const nodes: MarkdownInlineNode[] = [];
  let pos = node.from;

  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.from > pos) {
      pushText(nodes, markdown.slice(pos, child.from));
    }
    if (!hiddenNames.has(child.name)) {
      pushNodes(nodes, renderMarkdownNode(markdown, child));
    }
    pos = child.to;
  }

  if (node.to > pos) {
    pushText(nodes, markdown.slice(pos, node.to));
  }

  return nodes;
}

function markdownElement(
  tag: Extract<MarkdownInlineNode, { type: "element" }>["tag"],
  children: MarkdownInlineNode[],
  options: { className?: string; href?: string; wikiTarget?: string } = {},
): MarkdownInlineNode[] {
  return [{ type: "element", tag, children, ...options }];
}

function linkHref(markdown: string, node: SyntaxNode): string | undefined {
  const url = node.getChild("URL");
  if (!url) return undefined;
  return markdown.slice(url.from, url.to).trim();
}

function renderLink(markdown: string, node: SyntaxNode): MarkdownInlineNode[] {
  const children = renderMarkdownChildren(markdown, node, linkHiddenMarkdownNodes);
  const href = linkHref(markdown, node);
  if (children.length === 0 && href) {
    pushText(children, href);
  }
  return markdownElement("span", children, { className: "cm-rendered-link", href });
}

function renderMarkdownNode(markdown: string, node: SyntaxNode): MarkdownInlineNode[] {
  switch (node.name) {
    case "Document":
    case "Paragraph":
      return renderMarkdownChildren(markdown, node);
    case "StrongEmphasis":
      return markdownElement("strong", renderMarkdownChildren(markdown, node));
    case "Emphasis":
      return markdownElement("em", renderMarkdownChildren(markdown, node));
    case "Strikethrough":
      return markdownElement("s", renderMarkdownChildren(markdown, node));
    case "InlineCode":
      return markdownElement("code", renderMarkdownChildren(markdown, node), {
        className: "cm-inline-code",
      });
    case "Link":
    case "Autolink":
      return renderLink(markdown, node);
    case "WikiLink": {
      const rawTarget = markdown.slice(node.from + 2, node.to - 2);
      return markdownElement(
        "span",
        [{ type: "text", text: parseWikiLink(rawTarget).displayText }],
        {
          className: "cm-wiki-link",
          wikiTarget: rawTarget,
        },
      );
    }
    case "URL":
      return markdownElement("span", [{ type: "text", text: markdown.slice(node.from, node.to) }], {
        className: "cm-rendered-link",
        href: markdown.slice(node.from, node.to),
      });
    case "Image": {
      const alt = renderMarkdownChildren(markdown, node, linkHiddenMarkdownNodes);
      return alt.length > 0 ? alt : [{ type: "text", text: markdown.slice(node.from, node.to) }];
    }
    case "Escape":
      return [{ type: "text", text: markdown.slice(node.from + 1, node.to) }];
    case "Entity":
      return [{ type: "text", text: decodeMarkdownEntity(markdown.slice(node.from, node.to)) }];
    case "HardBreak":
      return [{ type: "break" }];
    case "Dash": {
      const dashCount = node.to - node.from;
      if (dashCount === 2) return [{ type: "text", text: "\u2013" }];
      if (dashCount === 3) return [{ type: "text", text: "\u2014" }];
      return [{ type: "text", text: markdown.slice(node.from, node.to) }];
    }
    case "Emoji": {
      const emojiName = markdown.slice(node.from + 1, node.to - 1);
      return [{ type: "text", text: emoji.get(emojiName) || markdown.slice(node.from, node.to) }];
    }
    default:
      if (node.firstChild) return renderMarkdownChildren(markdown, node);
      return [{ type: "text", text: markdown.slice(node.from, node.to) }];
  }
}

export function parseInlineMarkdown(markdown: string): MarkdownInlineNode[] {
  return renderMarkdownNode(markdown, inlineMarkdownParser.parse(markdown).topNode);
}

export function appendInlineMarkdownNodes(parent: HTMLElement, nodes: MarkdownInlineNode[]) {
  for (const node of nodes) {
    if (node.type === "text") {
      parent.appendChild(document.createTextNode(node.text));
      continue;
    }
    if (node.type === "break") {
      parent.appendChild(document.createElement("br"));
      continue;
    }

    const child = document.createElement(node.tag);
    if (node.className) child.className = node.className;
    if (node.href) child.dataset.href = node.href;
    if (node.wikiTarget) child.dataset.wikiTarget = node.wikiTarget;
    appendInlineMarkdownNodes(child, node.children);
    parent.appendChild(child);
  }
}

export function setInlineMarkdownContent(element: HTMLElement, markdown: string) {
  element.replaceChildren();
  appendInlineMarkdownNodes(element, parseInlineMarkdown(markdown));
}

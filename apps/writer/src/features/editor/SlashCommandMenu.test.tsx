import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SlashCommandItem } from "./slash-commands";
import { SlashCommandMenu, getSlashCommandOptionId } from "./SlashCommandMenu";

describe("SlashCommandMenu", () => {
  it("renders slash options with stable option ids", () => {
    const html = renderToStaticMarkup(
      <SlashCommandMenu
        items={[item("editor.insert.h2", "Heading 2", "Text")]}
        position={{ x: 120, y: 80 }}
        query="h2"
        selectedIndex={0}
        onHover={() => {}}
        onRun={() => {}}
      />,
    );

    expect(html).toContain('role="listbox"');
    expect(html).toContain('role="option"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('data-command-id="editor.insert.h2"');
    expect(html).toContain(getSlashCommandOptionId("editor.insert.h2"));
    expect(html).toContain("Heading 2");
  });

  it("renders an empty state for unmatched queries", () => {
    const html = renderToStaticMarkup(
      <SlashCommandMenu
        items={[]}
        position={{ x: 120, y: 80 }}
        query="unknown"
        selectedIndex={0}
        onHover={() => {}}
        onRun={() => {}}
      />,
    );

    expect(html).toContain("No blocks for");
    expect(html).toContain("/unknown");
  });
});

function item(id: string, label: string, group: string): SlashCommandItem {
  return {
    id,
    label,
    group,
    keywords: [],
    shortcut: "",
    priority: 1,
    command: {
      id,
      label,
      run: () => {},
    },
    order: 0,
  };
}

export interface TocItem {
  depth: 1 | 2 | 3;
  text: string;
  id: string;
}

export function buildToc(body: string): TocItem[] {
  return Array.from(body.matchAll(/^(#{1,3})\s+(.+)$/gm))
    .map((match) => {
      const depth = match[1].length as TocItem["depth"];
      const text = cleanHeadingText(match[2]);
      const id = headingToId(match[2]);

      return { depth, text, id };
    })
    .filter((item) => item.text && item.id)
    .slice(0, 12);
}

export function headingToId(heading: string): string {
  return cleanHeadingText(heading)
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function cleanHeadingText(heading: string): string {
  return heading
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#]/g, "")
    .trim();
}

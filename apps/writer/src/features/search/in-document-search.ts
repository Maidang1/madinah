export interface DocumentSearchMatch {
  index: number;
  length: number;
  line: number;
  column: number;
  preview: string;
}

export interface DocumentSearchOptions {
  caseSensitive?: boolean;
}

export function findDocumentMatches(
  source: string,
  query: string,
  options: DocumentSearchOptions = {},
): DocumentSearchMatch[] {
  if (!query) return [];

  const haystack = options.caseSensitive ? source : source.toLowerCase();
  const needle = options.caseSensitive ? query : query.toLowerCase();
  const lineStarts = getLineStarts(source);
  const matches: DocumentSearchMatch[] = [];
  let index = haystack.indexOf(needle);

  while (index >= 0) {
    const lineIndex = getLineIndex(lineStarts, index);
    const lineStart = lineStarts[lineIndex] ?? 0;
    const lineEnd = source.indexOf("\n", lineStart);
    matches.push({
      index,
      length: query.length,
      line: lineIndex + 1,
      column: index - lineStart + 1,
      preview: source
        .slice(lineStart, lineEnd >= 0 ? lineEnd : source.length)
        .trim(),
    });
    index = haystack.indexOf(needle, index + Math.max(needle.length, 1));
  }

  return matches;
}

export function getAdjacentMatchIndex(
  currentIndex: number,
  count: number,
  direction: "next" | "previous",
): number {
  if (count <= 0) return -1;
  if (currentIndex < 0) return direction === "next" ? 0 : count - 1;
  if (direction === "next") return (currentIndex + 1) % count;
  return (currentIndex - 1 + count) % count;
}

function getLineStarts(source: string): number[] {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function getLineIndex(lineStarts: number[], index: number): number {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const start = lineStarts[mid] ?? 0;
    const nextStart = lineStarts[mid + 1] ?? Number.POSITIVE_INFINITY;

    if (index >= start && index < nextStart) return mid;
    if (index < start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return 0;
}

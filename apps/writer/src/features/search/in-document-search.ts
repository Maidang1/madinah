export interface DocumentSearchMatch {
  index: number;
  length: number;
  line: number;
  column: number;
  preview: string;
}

export interface DocumentSearchOptions {
  caseSensitive?: boolean;
  /** Stop scanning once this many matches are found. */
  limit?: number;
}

export interface TextMatchRange {
  start: number;
  end: number;
}

export interface SearchScrollInput {
  containerTop: number;
  containerHeight: number;
  currentScrollTop: number;
  targetTop: number;
  targetHeight: number;
}

export const ACTIVE_DOCUMENT_SEARCH_MATCH_CLASS = "document-search-active-match";

export function findDocumentMatches(
  source: string,
  query: string,
  options: DocumentSearchOptions = {},
): DocumentSearchMatch[] {
  if (!query) return [];

  const haystack = options.caseSensitive ? source : source.toLowerCase();
  const needle = options.caseSensitive ? query : query.toLowerCase();
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const lineStarts = getLineStarts(source);
  const matches: DocumentSearchMatch[] = [];
  let index = haystack.indexOf(needle);

  while (index >= 0 && matches.length < limit) {
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

export function getNthTextMatch(
  text: string,
  query: string,
  occurrenceIndex: number,
  options: DocumentSearchOptions = {},
): TextMatchRange | null {
  if (!query || occurrenceIndex < 0) return null;

  const haystack = options.caseSensitive ? text : text.toLowerCase();
  const needle = options.caseSensitive ? query : query.toLowerCase();
  let found = haystack.indexOf(needle);
  let currentIndex = 0;

  while (found >= 0) {
    if (currentIndex === occurrenceIndex) {
      return {
        start: found,
        end: found + query.length,
      };
    }

    currentIndex += 1;
    found = haystack.indexOf(needle, found + Math.max(needle.length, 1));
  }

  return null;
}

/**
 * Replaces the `occurrenceIndex`-th match of `query` in `source` with
 * `replacement`, returning the rewritten source. Returns the original source
 * unchanged when the match cannot be located.
 */
export function replaceNthInSource(
  source: string,
  query: string,
  replacement: string,
  occurrenceIndex: number,
  options: DocumentSearchOptions = {},
): string {
  const match = getNthTextMatch(source, query, occurrenceIndex, options);
  if (!match) return source;
  return source.slice(0, match.start) + replacement + source.slice(match.end);
}

/**
 * Replaces every match of `query` in `source` with `replacement`. Scans left to
 * right on the original string and rebuilds the result, so overlapping is
 * avoided and positions never shift mid-pass. A non-matching or empty query
 * returns the source unchanged.
 */
export function replaceAllInSource(
  source: string,
  query: string,
  replacement: string,
  options: DocumentSearchOptions = {},
): { source: string; count: number } {
  if (!query) return { source, count: 0 };

  const haystack = options.caseSensitive ? source : source.toLowerCase();
  const needle = options.caseSensitive ? query : query.toLowerCase();
  const step = Math.max(needle.length, 1);

  let result = "";
  let cursor = 0;
  let count = 0;
  let found = haystack.indexOf(needle);

  while (found >= 0) {
    result += source.slice(cursor, found) + replacement;
    cursor = found + query.length;
    count += 1;
    found = haystack.indexOf(needle, found + step);
  }

  result += source.slice(cursor);
  return { source: result, count };
}

export function getCenteredSearchScrollTop(input: SearchScrollInput): number {
  return Math.max(
    0,
    input.currentScrollTop +
      (input.targetTop - input.containerTop) -
      input.containerHeight / 2 +
      input.targetHeight / 2,
  );
}

export function clearActiveDocumentSearchMatch(root: ParentNode): void {
  root
    .querySelectorAll?.(`.${ACTIVE_DOCUMENT_SEARCH_MATCH_CLASS}`)
    .forEach((element) => {
      element.classList.remove(ACTIVE_DOCUMENT_SEARCH_MATCH_CLASS);
    });
}

export function scrollActiveDocumentSearchMatchIntoView({
  root,
  query,
  occurrenceIndex,
  scroller,
}: {
  root: HTMLElement | null;
  query: string;
  occurrenceIndex: number;
  scroller?: HTMLElement | null;
}): boolean {
  if (!root || !query || occurrenceIndex < 0) return false;

  clearActiveDocumentSearchMatch(root);
  const range = getRangeForNthTextMatch(root, query, occurrenceIndex);
  if (!range) return false;

  const owner = getRangeOwnerElement(range);
  owner?.classList.add(ACTIVE_DOCUMENT_SEARCH_MATCH_CLASS);

  const scrollContainer = scroller ?? getSearchScrollContainer(root);
  const targetRect = range.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  scrollContainer.scrollTo({
    top: getCenteredSearchScrollTop({
      containerTop: containerRect.top,
      containerHeight: containerRect.height,
      currentScrollTop: scrollContainer.scrollTop,
      targetTop: targetRect.top,
      targetHeight: targetRect.height,
    }),
    behavior: "smooth",
  });

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
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

function getRangeForNthTextMatch(
  root: HTMLElement,
  query: string,
  occurrenceIndex: number,
): Range | null {
  const textNodes = getSearchableTextNodes(root);
  const combinedText = textNodes.map((entry) => entry.text).join("");
  const textMatch = getNthTextMatch(combinedText, query, occurrenceIndex);
  if (!textMatch) return null;

  const start = resolveTextPosition(textNodes, textMatch.start);
  const end = resolveTextPosition(textNodes, textMatch.end);
  if (!start || !end) return null;

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

function getSearchableTextNodes(
  root: HTMLElement,
): Array<{ node: Text; text: string; start: number; end: number }> {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Array<{ node: Text; text: string; start: number; end: number }> = [];
  let offset = 0;
  let current = walker.nextNode();

  while (current) {
    const text = current.textContent ?? "";
    nodes.push({
      node: current as Text,
      text,
      start: offset,
      end: offset + text.length,
    });
    offset += text.length;
    current = walker.nextNode();
  }

  return nodes;
}

function resolveTextPosition(
  nodes: Array<{ node: Text; start: number; end: number }>,
  offset: number,
): { node: Text; offset: number } | null {
  for (const entry of nodes) {
    if (offset >= entry.start && offset <= entry.end) {
      return {
        node: entry.node,
        offset: offset - entry.start,
      };
    }
  }

  const last = nodes[nodes.length - 1];
  if (last && offset === last.end) {
    return {
      node: last.node,
      offset: last.end - last.start,
    };
  }

  return null;
}

function getRangeOwnerElement(range: Range): HTMLElement | null {
  const container = range.commonAncestorContainer;
  return container instanceof HTMLElement ? container : container.parentElement;
}

function getSearchScrollContainer(root: HTMLElement): HTMLElement {
  return root.closest<HTMLElement>(".live-mdx-shell") ?? root;
}

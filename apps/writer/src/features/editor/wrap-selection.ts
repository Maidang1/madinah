/**
 * Paired symbols that, when typed while text is selected, should wrap the
 * selection rather than replacing it. This mirrors the "type a bracket over a
 * selection" behavior familiar from most code and prose editors.
 *
 * Markdown-semantic pairs (`*`, `_`) are intentionally excluded: bold/italic are
 * already bound to Cmd+B / Cmd+I and the selection toolbar, and wrapping them as
 * literal characters would fight the rich-text model. We keep this list to
 * brackets and quotes whose literal insertion is unambiguous.
 */
const WRAPPING_PAIRS: Record<string, string> = {
  "`": "`",
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "（": "）",
  "「": "」",
  "『": "』",
  "“": "”",
  "‘": "’",
  "《": "》",
};

export interface WrappedSelection {
  opening: string;
  closing: string;
  text: string;
}

/**
 * Returns the wrapped form of `selectedText` for the given typed `key`, or null
 * when the key is not a wrapping character (so the caller lets the default
 * insertion happen).
 */
export function getWrappedSelection(
  key: string,
  selectedText: string,
): WrappedSelection | null {
  const closing = WRAPPING_PAIRS[key];
  if (closing === undefined) return null;
  if (!selectedText) return null;
  return { opening: key, closing, text: `${key}${selectedText}${closing}` };
}

export function isWrappingKey(key: string): boolean {
  return key in WRAPPING_PAIRS;
}

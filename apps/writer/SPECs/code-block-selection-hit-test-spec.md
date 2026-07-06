# Code Block Selection Hit Test

## Problem

Clicking near the top of a fenced Markdown code block can place the caret several source lines below the clicked line in the desktop editor.

## Root Cause

Fenced code lines had two owners for visual text metrics:

- `codeFenceTheme` declared the code block font size through the editor sizing variable.
- `prosemark-theme.css` overrode the rendered fenced-code lines to a fixed `12px`.
- `prosemark-theme.css` also owned the rendered fenced-code line height while the
  CodeMirror theme used by hit-testing did not declare the same value.

The extension also injected a first-line code-block info widget whose visible children were hidden by product CSS, leaving an extra inline DOM target inside the source-backed code range.

A follow-up WebView regression showed a second hit-test path:

- CodeMirror's state selection could land on the next fenced-code source line even when the browser DOM selection and mouse coordinates were on the clicked line.
- `.cm-activeLine` styles existed, but the editor did not enable CodeMirror's `highlightActiveLine()` extension, so the active-line state was not covered by automated testing.

## Fix

- Keep fenced code blocks as source-backed CodeMirror lines with line decorations only.
- Remove the hidden first-line info widget.
- Use a dedicated `--writer-code-block-font-size: 14px` token for the runtime fenced-code CSS so the measured line geometry matches the visible code text.
- Use a dedicated `--writer-code-block-line-height: 1.75` token from both the
  CodeMirror theme and the runtime CSS so click mapping, caret drawing, and the
  visible line boxes use the same vertical metric.
- Enable CodeMirror active-line highlighting and add a fenced-code click correction extension. For simple clicks inside `.cm-fenced-code-line`, the extension maps the browser DOM caret at the mouse point back through `view.posAtDOM(...)` and dispatches that cursor position after mouseup. Drag selection and modified clicks stay on the default CodeMirror path.

## Validation

- `vp test --run tests/code-fence-extension.test.ts tests/madinah-render-contract.test.ts`
- `vp check`
- `PATH="/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$HOME/.cargo/bin:$PATH" pnpm run build:app` from `apps/desktop/e2e`
- `PATH="/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$HOME/.cargo/bin:$PATH" CI=true pnpm run test:wdio -- --spec ./specs/code-block-hit-test.spec.js` from `apps/desktop/e2e`

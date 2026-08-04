# Worksheet: Writer and blog interface system polish

## References

- TODO: `Writer and blog interface system polish`
- Spec: `SPECs/interface-system-polish-spec.md`
- User request: optimize the collaboration-side and blog styles using the full `better-interface` review.

## Reviewed

- `AGENTS.md`, `TODOS.md`, `CHANGELOG.md`
- `docs/workflows/agent-loop.md`, `docs/workflows/agent-review.md`
- `docs/consolidation.md`, `docs/react-guidelines.md`
- All six `better-interface` owner skills and the relevant accessibility, layout, typography, color, and UI references.
- Astro layout, index, article route, shared reader theme, and global styles.
- Writer app shell, sidebar, tabs, editor pane/footer, welcome state, shared icon button, theme tokens, and existing screenshot.
- Baseline checks: `pnpm exec vp check` and `pnpm exec vp test` passed (29 files / 318 tests). Global `vp` is unavailable, so the project-local binary is used.
- Baseline blog index screenshot at 1440×1000, plus a 390×844 cropped bitmap later shown by CDP to contain a 500px layout viewport rather than a true mobile baseline.

## Findings and boundaries

- The blog and Writer already share reader typography, but their surrounding surfaces and interaction language do not yet feel like one system.
- Blog list rows depend on repeated separators and have weak interactive surface cues. The apparent 390px title clipping in the first headless screenshot was rejected as a browser-tool artifact: CDP reported an actual 500px layout viewport cropped into a 390px bitmap, with `scrollWidth === clientWidth`. True 320–390px reflow still needs device-metrics verification.
- The article body typography, including its narrower mobile scale, is an intentional reader design and stays outside the visual-polish changes.
- The blog back-to-top control explicitly removes focus without a replacement.
- Writer globally disables selection outside the editor/forms, making useful labels, errors, and values impossible to copy.
- Writer sidebar, tab chrome, and editor canvas have limited surface separation; section labels and some icon controls use 20–28px targets.
- Review boundary: primary Writer workspace flow and public blog list/article flow. Specialist overlays and compact-mode internals are not independently redesigned.

## Plan

1. Keep `shared/reader-theme.css` limited to `--reader-*` reading defaults. Add only reader-surface roles that both renderers can safely inherit; Writer chrome continues deriving from its configurable primaries and never consumes a static blog accent.
2. Restyle the Writer shell through existing Tailwind/CSS owners, without new React state: a dedicated derived chrome surface, clearer tab/section states, selectable static labels/errors/values with explicit non-selectable drag/control exceptions, larger target geometry on the actual local buttons, a calmer footer, and a more informative welcome card. Do not change `IconButton` unless compact mode is added to the regression scope.
3. Restyle the Astro list/article surfaces while preserving the existing body typography: stronger intro hierarchy, grouped post cards, resilient wrapping, refined article controls/TOC/images, and visible focus.
4. Keep motion interruptible and explicit; make the article's JS-driven TOC scrolling consult `prefers-reduced-motion` in addition to the CSS fallback.
5. Validate the blog with device-metrics overrides at exact 320/390 widths and desktop, using `mdx-handwritten-design` plus `how-to-clone-a-website` as stress content. Record viewport/root scroll dimensions and intentional local overflow.
6. Validate Writer at 1200×800 and 800×500 across light/dark, sidebar/tab/editor/footer/welcome states, plus one fixed non-default accent/background/foreground configuration with low contrast and translucency and one high-contrast configuration. Measure the named control hit boxes and traverse them by keyboard; smoke-check excluded surfaces that inherit global rules.
7. Separately measure and keyboard-check the desktop TOC rail, mobile TOC summary/expanded links, and the back-to-top button after scrolling it into view.

## Risks

- Theme tokens are shared; every change must be checked in Writer and both blog appearances.
- Writer translucency makes contrast backdrop-dependent; chrome layers must remain subtle but opaque enough over the editor.
- The desktop app cannot be treated exactly like a touch-first site; target growth must preserve high-density writing workflows.

## Result

Completed on 2026-08-04.

### Implementation

- Writer now paints the configurable `--bg` once and differentiates sidebar/footer/welcome chrome with foreground-derived overlays, preserving custom background, translucency, and contrast ownership.
- Workspace tabs, sidebar sections, recurring controls, footer metrics, focus states, selection rules, and the no-workspace welcome state were refined without adding React state or changing compact-mode controls.
- The blog list and article surfaces now use grouped editorial cards, resilient narrow-screen wrapping, accessible focus and active TOC states, reduced-motion-aware scrolling, and neutral image outlines while preserving the original article body typography.
- Independent implementation review findings were resolved: fixed-alpha Writer background stacking, custom-theme footer leakage, missing Writer reduced-motion handling, hidden settings/inspector button focus, keyboard tab-title masking, desktop TOC `aria-current`, and false-positive legacy copy fallback feedback.

### Runtime acceptance evidence

- Blog exact-width reflow: real device-metrics runs at 320px and 390px reported `innerWidth === clientWidth === scrollWidth`; `mdx-handwritten-design` and `how-to-clone-a-website` kept long code inside locally scrolling `pre` elements rather than widening the root.
- Blog control geometry/focus: 390px list card `362×153`, back-to-top `42×42`; desktop article back `99×36`, share `72×36`, TOC link `136×62`, back-to-top `42×42`; mobile TOC summary `314×32` and expanded link `290×44`. Tested controls exposed a visible 2px solid focus outline.
- Blog motion and contrast: reduced-motion media emulation produced `0.00001s` transition durations and JS TOC scrolling selected `auto`. Measured light contrast ratios were ink `10.76`, muted `7.21`, accent `5.30`; dark ratios were ink `9.67`, muted `6.29`, accent `6.24`.
- Writer workspace: 1200×800 light/dark file states and 800×500 custom/high-contrast file states all reported `innerWidth === clientWidth === scrollWidth`; welcome was separately checked at 800×500 light/dark/custom/high-contrast.
- Writer themes: fixed custom low/translucent configuration used accent `#3157D8`, background `#E8EDF8`, foreground `#172033`, `--bg-opacity: 0.335`, contrast `0.24`; maximum translucency preserved `--bg-opacity: 0.05` with computed root background alpha `0.05`, a transparent welcome viewport background, and foreground-only footer/chrome overlays (`0.0288` alpha). High contrast used accent `#FF8A3D`, background `#080808`, foreground `#FFFFFF`, opacity/contrast `1`.
- Writer control geometry/focus: sidebar toggle/back/forward were `32×32`, close was `24×24`, new tab `36×32`, search `216×32`, section disclosure `216×28`, tree row `216×32`; enabled controls exposed a 2px solid focus outline. Disabled navigation controls intentionally had no focus outline.
- Writer selection/gesture ownership: computed `user-select` was `auto` on body/static content and `none` on buttons, Tauri drag region, resize handle, and tree rows. Source and runtime smoke checks retained existing resize/tree gesture owners.
- Writer reduced motion: media emulation matched `prefers-reduced-motion: reduce`; sampled control transitions computed to `0.00001s`.
- Visual artifacts are stored under `/tmp/madinah-interface-review` for the session, including the narrow blog matrix and Writer workspace/welcome theme matrix.

### Verification

- `pnpm exec vp check` — passed, 169 lint-clean files and 287 correctly formatted files.
- `pnpm exec vp test` — passed, 29 files / 320 tests.
- `pnpm run build` in `apps/writer` — passed.
- `pnpm build` at repository root — passed and prerendered all blog routes.
- `cargo test` — passed, 137 tests.
- `cargo clippy` — passed with existing dead-code/style warnings in untouched Rust files.
- `cargo fmt --check` — passed.
- `git diff --check` — passed.

# Writer and blog interface system polish

## Goal

Make the Writer workspace and Madinah blog feel like two parts of the same editorial product: Writer is the focused production surface, while the blog is the calm reading surface. Improve hierarchy, spacing, typography, color roles, interaction states, and narrow-width behavior without changing document, navigation, or publishing behavior.

## Scope

- Shared reader tokens used by Writer and Astro.
- Writer's primary workspace shell: sidebar, tab chrome, editor canvas, document footer, recurring local icon controls, and no-workspace welcome state.
- Blog index and article detail surfaces, including desktop, narrow-width, light, dark, hover, focus, and reduced-motion states.
- User-facing copy immediately attached to the changed blog controls.

Specialist settings, AI, metadata, compact-picker, and editor-widget redesigns are outside this pass except where they inherit a shared token or focus rule.

## Requirements

- Preserve the existing CSS/Tailwind conventions and theme customization pipeline.
- Keep token ownership explicit: `shared/reader-theme.css` owns only `--reader-*` reading defaults; Writer chrome remains derived from its configurable `--accent`, `--bg-base`, `--fg-base`, opacity, and contrast primaries. Static blog accent values must not override Writer theme customization.
- Keep Writer dense enough for a desktop writing tool while making chrome layers and active states distinguishable.
- Keep long-form article text at a comfortable reading size and measure on narrow viewports.
- Prevent long titles, descriptions, URLs, and mixed Chinese/English text from forcing page-level horizontal scrolling.
- Keep all primary controls keyboard-visible and at least 24px in their real hit geometry; prefer 32–40px for recurring desktop controls.
- Preserve reduced-motion behavior and use explicit transition properties.
- Use semantic color roles; the warm accent remains reserved for interactive emphasis.
- Keep blog images visually separated from both light and dark paper surfaces with neutral outlines.
- Keep useful static labels, errors, and values selectable in Writer, while buttons, tabs, tree rows, drag regions, and resize/drag handles remain non-selectable so existing window and file-tree gestures are unchanged.
- Honor reduced motion in CSS and in programmatic article scrolling.

## Acceptance

- Writer check, tests, and build pass.
- Astro build passes.
- Blog index plus `/blog/mdx-handwritten-design` are visually inspected at desktop, exact 390px, and exact 320px widths in both appearances. The article supplies mixed CJK/Latin text, long links, code, tables, and MDX components; `/blog/how-to-clone-a-website` supplies remote images and additional code. Record `innerWidth`, root `clientWidth`, root `scrollWidth`, and any intentionally local scrolling container.
- Writer is visually inspected at 1200×800 and its configured 800×500 minimum in light and dark appearances, covering sidebar expanded/collapsed, active/inactive and many-tab chrome, editor/footer, and the no-workspace welcome state. Also check one non-default accent/background/foreground configuration with low contrast plus translucency, and one high-contrast configuration.
- Keyboard focus remains visible on the blog's back, share, article-card, table-of-contents, and back-to-top controls.
- Blog focus/geometry checks separately cover the desktop TOC rail, the mobile TOC summary and expanded links, and the back-to-top control after scrolling it into its visible state; each recurring control measures at least 24×24px.
- Writer keyboard traversal covers sidebar toggle/search/section disclosures/tree, tab selection/close/new/back/forward, and welcome actions. Hover-only tab close affordances also reveal on `focus-within`; every listed control has real geometry of at least 24×24px, with recurring chrome controls kept at 32px where space permits.
- A 320–390px blog viewport has no page-level horizontal overflow for representative content.
- Reduced-motion verification confirms programmatic TOC scrolling becomes instant and CSS motion is suppressed.
- Shared-token and global focus/selection smoke checks cover the excluded settings, Properties, AI, compact-picker, and editor-widget surfaces without independently redesigning them.

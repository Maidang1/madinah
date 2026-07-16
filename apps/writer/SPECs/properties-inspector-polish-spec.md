# Properties Inspector Visual Polish

## Problem

The Properties inspector uses a fixed-width, full-height drawer even when a document has only a
few frontmatter fields. In a compact Writer window this creates a large blank surface, obscures too
much of the document, and gives transparent inputs too little editing affordance. Multiline values
such as `description` are also forced into the same horizontal row as short metadata fields.

## Goal

Present document properties as a compact, responsive floating card whose height follows its
content while keeping every existing frontmatter editing behavior intact.

## Requirements

- Open Properties as a non-modal, right-aligned floating card below the document chrome instead of
  a full-height drawer. Keep the document interactive and do not add a modal backdrop.
- Size the card against its containing editor pane, not the outer window, so an open app sidebar
  cannot cause the inspector to clip.
- Bound the card to the available pane height and scroll only its property content when necessary.
- On very narrow panes, keep ordinary card margins inside the pane and allow the card to grow
  vertically between the top and bottom chrome.
- Keep the header and Add property action as fixed siblings outside the scrolling field list.
- Give editable values a subtle field surface with hover and focus feedback.
- Keep short fields in a compact label/value layout, but render `description` as a stacked,
  full-width multiline control.
- Prevent date values and property removal controls from competing for horizontal space.
- Keep remove controls in the keyboard tab order, visible without hover, and specifically labelled
  for the property they remove.
- After keyboard removal, move focus to the next property, previous property, or Add property action
  so editing can continue inside the inspector.
- Focus the close control when the inspector opens from any entry point. When it closes through its
  own close control or Escape, restore focus to the Properties trigger.
- Expose the trigger/inspector relationship through expanded, controls, and labelled-by semantics.
- Preserve Escape dismissal, file-switch dismissal, property create/update/remove behavior,
  typed controls, publication status, and the View online action.
- Keep the removed Publish/Publish update actions absent.

## Validation

- Run `vp check`, the full `vp test` suite, and the focused frontmatter/yaml-entry suites.
- Open Writer through the local frontend dev server and verify the closed trigger, open card,
  description wrapping, date field, Add property action, and narrow pane behavior.
- Exercise open/close, Escape and focus return, create/add/edit/remove, every typed control, View
  online/status visibility, and Publish absence. Verify no-, few-, and many-property documents at
  regular, narrow, and short pane sizes, including fields-only scrolling with a fixed header/footer.

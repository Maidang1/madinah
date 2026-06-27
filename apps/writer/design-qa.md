# Design QA

final result: passed

Reference:
- `/var/folders/ch/z5rhm_px2zv83ggkns8k456c0000gn/T/codex-clipboard-444554dd-a105-485f-8f2d-67591fa8f744.png`

Prototype screenshot:
- `/Users/bytedance/codes/myself/madinah/apps/writer/madinah-writer-qa.png`

Tauri screenshot checked:
- `/var/folders/ch/z5rhm_px2zv83ggkns8k456c0000gn/T/codex-clipboard-00e49996-4634-4b75-bc8c-238f01d51c7a.png`

Checks:
- Dark split-view surface matches the reference structure: wide file sidebar, single editor pane, compact top chrome.
- Titlebar title is centered across the window and right-side word/view controls match the reference placement.
- Editor content starts at the same left offset from the editor pane and uses a sans-serif writing surface.
- Sidebar uses a file-tree hierarchy with folder/document icons, hover state, active row, and expand/collapse controls.
- Tauri high-DPI layout uses a 360px logical sidebar and 72px logical editor left inset to match the reference proportions in the native window.

Remaining polish:
- The exact document title, edited state, word count, and tree contents depend on local document data.

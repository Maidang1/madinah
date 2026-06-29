# Writer Agent Instructions

## Rendering Parity

- Light mode colors across the whole app chrome must stay in the Madinah blog warm reader palette. Use the blog `reader-*` color tokens from `/Users/bytedance/codes/myself/madinah/src/styles/global.css` and keep `src/styles/app.css` aligned for the window, titlebar, sidebar, inspector, controls, page background, content surface, text, muted text, borders, code blocks, and blockquotes.
- Rendered Markdown and MDX typography must match the Madinah blog. Preserve the Jinkai stylesheet loaded from `index.html` (`https://assets.felixwliu.cn/fonts/jinkai/jinkai.css`) and route preview typography through the blog `reader-font`/post content font stack.
- Before changing preview or editor rendering, compare the result against the real blog surface under `/Users/bytedance/codes/myself/madinah/src` and keep `src/styles/app.css` as the primary writer-side alignment point.

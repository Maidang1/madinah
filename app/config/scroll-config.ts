export const SCROLL_CONFIG = {
  // 滚动到顶部按钮显示的阈值
  SCROLL_TO_TOP_THRESHOLD: 500,
  
  // 标题高亮的偏移量（距离顶部的距离）
  HEADING_HIGHLIGHT_OFFSET: 120,
  
  // 高亮检测的缓冲区（超过偏移量多少像素还算在当前标题内）
  HIGHLIGHT_BUFFER: 50,
  
  // 滚动行为
  SCROLL_BEHAVIOR: 'smooth' as ScrollBehavior,
} as const;

export type ScrollConfig = typeof SCROLL_CONFIG;

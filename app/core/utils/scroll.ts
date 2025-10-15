import { SCROLL_CONFIG } from '~/core/config/scroll';

/**
 * 滚动到指定元素
 */
export function scrollToElement(
  targetId: string,
  options: {
    offset?: number;
    behavior?: ScrollBehavior;
    container?: Element | null;
  } = {}
) {
  const {
    offset = SCROLL_CONFIG.HEADING_HIGHLIGHT_OFFSET,
    behavior = SCROLL_CONFIG.SCROLL_BEHAVIOR,
    container = null
  } = options;

  const targetElement = document.getElementById(targetId);
  if (!targetElement) return false;

  const scrollContainer = container || document.querySelector('.scroll-container') || window;
  let scrollTop = 0;

  if (scrollContainer === window) {
    scrollTop = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({
      top: scrollTop,
      behavior,
    });
  } else {
    const containerElement = scrollContainer as HTMLElement;
    const containerRect = containerElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    scrollTop = containerElement.scrollTop + (targetRect.top - containerRect.top) - offset;
    containerElement.scrollTo({
      top: scrollTop,
      behavior,
    });
  }

  return true;
}

/**
 * 获取当前滚动位置
 */
export function getScrollPosition(container?: Element | null) {
  const scrollContainer = container || document.querySelector('.scroll-container') || window;

  if (scrollContainer === window) {
    return window.pageYOffset;
  } else {
    return (scrollContainer as HTMLElement).scrollTop;
  }
}

/**
 * 滚动到顶部
 */
export function scrollToTop(options: {
  behavior?: ScrollBehavior;
  container?: Element | null;
} = {}) {
  const {
    behavior = SCROLL_CONFIG.SCROLL_BEHAVIOR,
    container = null
  } = options;

  const scrollContainer = container || document.querySelector('.scroll-container') || window;

  if (scrollContainer === window) {
    window.scrollTo({
      top: 0,
      behavior,
    });
  } else {
    (scrollContainer as HTMLElement).scrollTo({
      top: 0,
      behavior,
    });
  }
}



/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

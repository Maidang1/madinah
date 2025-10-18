import { SCROLL_CONFIG } from "~/core/config/scroll";

const DEFAULT_CONTAINER_SELECTOR = ".scroll-container";

type ScrollContainer = Element | Window;

export interface ScrollToElementOptions {
  offset?: number;
  behavior?: ScrollBehavior;
  container?: Element | null;
}

export interface ScrollToTopOptions {
  behavior?: ScrollBehavior;
  container?: Element | null;
}

const resolveScrollContainer = (
  container?: Element | null,
): ScrollContainer => {
  if (container) {
    return container;
  }

  const explicitContainer = document.querySelector(DEFAULT_CONTAINER_SELECTOR);
  return explicitContainer ?? window;
};

const getScrollTop = (element: HTMLElement) => element.scrollTop;

const computeElementOffset = (target: Element, container: ScrollContainer) => {
  if (container === window) {
    return target.getBoundingClientRect().top + window.scrollY;
  }

  const containerElement = container as HTMLElement;
  const containerBounds = containerElement.getBoundingClientRect();
  const targetBounds = target.getBoundingClientRect();
  return (
    getScrollTop(containerElement) + (targetBounds.top - containerBounds.top)
  );
};

/**
 * Smoothly scrolls a container so that the target element comes into view.
 */
export const scrollToElement = (
  targetId: string,
  options: ScrollToElementOptions = {},
): boolean => {
  if (!targetId) {
    return false;
  }

  const targetElement = document.getElementById(targetId);
  if (!targetElement) {
    return false;
  }

  const {
    offset = SCROLL_CONFIG.HEADING_HIGHLIGHT_OFFSET,
    behavior = SCROLL_CONFIG.SCROLL_BEHAVIOR,
    container = null,
  } = options;

  const scrollContainer = resolveScrollContainer(container);
  const top = computeElementOffset(targetElement, scrollContainer) - offset;

  if (scrollContainer === window) {
    window.scrollTo({ top, behavior });
  } else {
    (scrollContainer as HTMLElement).scrollTo({ top, behavior });
  }

  return true;
};

/**
 * Reports the current vertical scroll position for the target container.
 */
export const getScrollPosition = (container?: Element | null): number => {
  const scrollContainer = resolveScrollContainer(container);
  return scrollContainer === window
    ? window.scrollY
    : getScrollTop(scrollContainer as HTMLElement);
};

/**
 * Scrolls the given container back to the top.
 */
export const scrollToTop = (options: ScrollToTopOptions = {}) => {
  const {
    behavior = SCROLL_CONFIG.SCROLL_BEHAVIOR,
    container = null,
  } = options;

  const scrollContainer = resolveScrollContainer(container);

  if (scrollContainer === window) {
    window.scrollTo({ top: 0, behavior });
    return;
  }

  (scrollContainer as HTMLElement).scrollTo({ top: 0, behavior });
};

/**
 * Ensures the wrapped function only executes once per window defined by `delay`.
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = delay - (now - lastCall);

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastCall = now;
      fn(...args);
      return;
    }

    if (!timeout) {
      timeout = setTimeout(() => {
        lastCall = Date.now();
        timeout = null;
        fn(...args);
      }, remaining);
    }
  };
}

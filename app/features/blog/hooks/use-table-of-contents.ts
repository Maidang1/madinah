import { useState, useEffect, useCallback } from 'react';
import { SCROLL_CONFIG } from '~/core/config/scroll';
import { scrollToElement, getScrollPosition, throttle } from '~/core/utils/scroll';
import { TocItem } from '~/types';

interface UseTableOfContentsProps {
  tocs: TocItem[];
  offset?: number;
  highlightBuffer?: number;
}

export function useTableOfContents({
  tocs,
  offset = SCROLL_CONFIG.HEADING_HIGHLIGHT_OFFSET,
  highlightBuffer = SCROLL_CONFIG.HIGHLIGHT_BUFFER
}: UseTableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    const targetId = url.slice(1);
    // 直接使用 window 作为滚动容器，因为页面使用的是 window 滚动
    scrollToElement(targetId, {
      offset,
      container: null // null 会被解析为 window
    });
  }, [offset]);

  useEffect(() => {
    const handleScroll = throttle(() => {
      if (tocs.length === 0) return;

      // 获取所有标题元素
      const headingElements = tocs
        .map(toc => document.getElementById(toc.url.slice(1)))
        .filter(Boolean) as HTMLElement[];

      if (headingElements.length === 0) return;

      // 使用 window 作为滚动容器
      const scrollTop = window.scrollY;

      // 找到当前视窗内的标题
      let currentActiveId = '';

      for (const element of headingElements) {
        const rect = element.getBoundingClientRect();
        const elementTop = rect.top + scrollTop;

        // 如果标题在视窗上方一定距离内，则认为是当前活跃的
        if (elementTop <= scrollTop + offset + highlightBuffer) {
          currentActiveId = element.id;
        } else {
          break;
        }
      }

      // 如果没有找到活跃的标题，使用第一个
      if (!currentActiveId && headingElements.length > 0) {
        currentActiveId = headingElements[0].id;
      }

      if (currentActiveId !== activeId) {
        setActiveId(currentActiveId);
      }
    }, 16); // 60fps

    // 初始化
    handleScroll();

    // 监听 window 的滚动事件
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [tocs, activeId, offset, highlightBuffer]);

  return {
    activeId,
    handleClick,
  };
}

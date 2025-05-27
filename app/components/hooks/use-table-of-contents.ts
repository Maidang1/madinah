import { useState, useEffect, useCallback } from 'react';
import { SCROLL_CONFIG } from '../config/scroll-config';
import { TocItem } from '../types';
import { scrollToElement, getScrollPosition, throttle } from '../utils/scroll-utils';

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
    scrollToElement(targetId, { offset });
  }, [offset]);

  useEffect(() => {
    const handleScroll = throttle(() => {
      if (tocs.length === 0) return;

      // 获取所有标题元素
      const headingElements = tocs
        .map(toc => document.getElementById(toc.url.slice(1)))
        .filter(Boolean) as HTMLElement[];

      if (headingElements.length === 0) return;

      const scrollTop = getScrollPosition();
      const scrollContainer = document.querySelector('.scroll-container') || window;
      let containerTop = 0;

      if (scrollContainer !== window) {
        containerTop = (scrollContainer as HTMLElement).getBoundingClientRect().top;
      }

      // 找到当前视窗内的标题
      let currentActiveId = '';
      
      for (const element of headingElements) {
        const rect = element.getBoundingClientRect();
        const elementTop = scrollContainer === window 
          ? rect.top + scrollTop 
          : rect.top + scrollTop - containerTop;

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

    // 监听滚动事件
    const scrollContainer = document.querySelector('.scroll-container') || window;
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [tocs, activeId, offset, highlightBuffer]);

  return {
    activeId,
    handleClick,
  };
}

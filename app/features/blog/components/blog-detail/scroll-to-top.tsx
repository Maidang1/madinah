import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { SCROLL_CONFIG } from '~/core/config/scroll';
import { getScrollPosition, scrollToTop, throttle } from '~/core/utils/scroll';
import { useTranslation } from '~/core/i18n';

interface ScrollToTopButtonProps {
  threshold?: number;
  className?: string;
}

export function ScrollToTopButton({
  threshold = SCROLL_CONFIG.SCROLL_TO_TOP_THRESHOLD,
  className,
}: ScrollToTopButtonProps) {
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const handleScroll = throttle(() => {
      const scrollTop = getScrollPosition();
      setShowScrollToTop(scrollTop > threshold);
    }, 16); // 60fps

    const scrollContainer =
      document.querySelector('.scroll-container') || window;
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    // 初始检查
    handleScroll();

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [threshold]);

  const handleScrollToTop = () => {
    scrollToTop();
  };

  return (
    <AnimatePresence>
      {showScrollToTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleScrollToTop}
          className={`bg-main-500 text-primary-foreground hover:bg-main-500/90 focus:ring-primary/50 fixed right-8 bottom-8 z-50 rounded-full p-3 shadow-lg transition-colors duration-200 focus:ring-2 focus:ring-offset-2 focus:outline-none ${className || ''}`}
          aria-label={t('blog.detail.scrollToTop')}
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

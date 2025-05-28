import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { SCROLL_CONFIG } from '../../config/scroll-config';
import { getScrollPosition, scrollToTop, throttle } from '../../utils/scroll-utils';

interface ScrollToTopButtonProps {
  threshold?: number;
  className?: string;
}

export function ScrollToTopButton({ 
  threshold = SCROLL_CONFIG.SCROLL_TO_TOP_THRESHOLD, 
  className 
}: ScrollToTopButtonProps) {
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  useEffect(() => {
    const handleScroll = throttle(() => {
      const scrollTop = getScrollPosition();
      setShowScrollToTop(scrollTop > threshold);
    }, 16); // 60fps

    const scrollContainer = document.querySelector('.scroll-container') || window;
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
          className={`fixed bottom-8 right-8 z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 ${className || ''}`}
          aria-label='Scroll to top'
        >
          <ArrowUp className='w-5 h-5' />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

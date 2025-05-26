"use client";

import { Outlet, ScrollRestoration, useLocation, NavLink } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PostInfo } from '~/types';
import { cn } from '~/lib/utils';
import { ArrowUp } from 'lucide-react';

interface BlogsDetailProps {
  list: PostInfo[];
}

export default function BlogsDetail({ list }: BlogsDetailProps) {
  const { pathname } = useLocation();
  const listItem = list.find((listItem) => listItem.url === pathname);
  const tocs = listItem?.toc ?? [];
  const title = listItem?.title;
  const summary = listItem?.summary;
  const [activeUrl, setActiveUrl] = useState('');

  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
    url: string
  ) => {
    e.preventDefault();
    setActiveUrl(url);
    const targetElement = document.getElementById(url.slice(1));
    const scrollContainer = document.querySelector('.scroll-container');

    if (targetElement && scrollContainer) {
      const elementPosition = targetElement.getBoundingClientRect().top;
      const offsetPosition = elementPosition + scrollContainer.scrollTop - 120;
      if (!scrollContainer) return;
      scrollContainer.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const [showScrollToTop, setShowScrollToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <div className='container mx-auto mt-4 pt-6 sm:pt-12 max-w-7xl px-4 sm:px-6'>
      <ScrollRestoration />
      <div className='flex flex-col lg:flex-row gap-8 relative'>
        {/* Table of Contents */}
        <div className='lg:w-64 xl:w-80 shrink-0 hidden lg:block'>
          <div className='sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto'>
            <div className='pb-6 border-b border-border/50 mb-6'>
              <h3 className='font-medium text-lg mb-4 flex items-center'>
                <span className='i-lucide-list-ordered mr-2 w-5 h-5' />
                Table of Contents
              </h3>
              <nav className='space-y-2'>
                {tocs.map((toc) => (
                  <NavLink
                    key={toc.url}
                    to={toc.url}
                    onClick={(e) => handleClick(e, toc.url)}
                    className={({ isActive }) =>
                      cn(
                        'block text-sm py-1.5 px-3 rounded-md transition-colors',
                        'text-muted-foreground hover:text-foreground hover:bg-accent',
                        isActive && 'text-primary font-medium bg-accent'
                      )
                    }
                  >
                    {toc.value}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className='flex-1 min-w-0'>
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className='prose dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-3xl sm:prose-h1:text-4xl prose-h1:mb-6 prose-img:rounded-xl prose-img:shadow-lg'
          >
            <header className='mb-8'>
              <h1 className='text-3xl sm:text-4xl font-bold mb-6 text-center'>{title}</h1>
              {summary && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className='bg-gradient-to-r from-primary/5 to-primary/10 border-l-4 border-primary p-6 rounded-r-lg mb-8 not-prose'
                >
                  <div className='flex items-start gap-3'>
                    <div className='bg-primary/10 p-2 rounded-lg text-primary'>
                      <span className='i-lucide-sparkles w-5 h-5 block' />
                    </div>
                    <div>
                      <h3 className='font-medium text-lg flex items-center gap-2 mb-2'>
                        <span>AI 摘要</span>
                        <span className='text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full'>Beta</span>
                      </h3>
                      <p className='text-muted-foreground text-sm leading-relaxed'>{summary}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </header>
            <div className='mt-8'>
              <Outlet />
            </div>
          </motion.article>
        </div>

        {/* Right Sidebar - Empty for now */}
        <div className='lg:w-64 xl:w-80 shrink-0 hidden xl:block' />

        {/* Scroll to Top Button */}
        <AnimatePresence>
          {showScrollToTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={scrollToTop}
              className='fixed bottom-8 right-8 z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2'
              aria-label='Scroll to top'
            >
              <ArrowUp className='w-5 h-5' />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

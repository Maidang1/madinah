import { Outlet } from '@remix-run/react';
import { motion } from 'motion/react';
import type { ReadTimeResults } from "reading-time"
import { MDXWrapper } from '~/components/mdx/mdx-wrapper';


interface BlogContentProps {
  title?: string;
  summary?: string;
  className?: string;
}

export function DetailHeader({ title, summary, className }: BlogContentProps) {
  return (
    <div className={`flex-1 min-w-0 ${className || ''}`}>
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className='max-w-none'
      >
        {(title || summary) && (
          <header className='mb-8'>
            {title && (
              <h1 className='text-3xl sm:text-4xl font-bold mb-6 text-center'>
                {title}
              </h1>
            )}
            {summary && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className='relative overflow-hidden bg-gradient-to-br from-blue-50/80 via-indigo-50/60 to-purple-50/80 dark:from-blue-950/20 dark:via-indigo-950/30 dark:to-purple-950/20 border border-blue-200/50 dark:border-blue-800/30 p-6 rounded-2xl mb-8 not-prose shadow-sm backdrop-blur-sm'
              >
                <div className='absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-xl'></div>
                <div className='absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-indigo-400/10 to-blue-400/10 rounded-full blur-lg'></div>
                <div className='relative z-10'>
                  <div className='flex items-center gap-3 mb-4'>
                    <div className='flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm'>
                      <span className='i-simple-icons-openai text-white w-4 h-4 block' />
                    </div>
                    <div className='flex flex-col'>
                      <span className='text-sm font-semibold text-blue-700 dark:text-blue-300'>AI 摘要</span>
                      <span className='text-xs text-blue-600/70 dark:text-blue-400/70'>智能生成</span>
                    </div>
                  </div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className='text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium'
                  >
                    {summary}
                  </motion.p>
                </div>
              </motion.div>
            )}
          </header>
        )}
        <MDXWrapper className='mt-8 pb-[800px]'>
          <Outlet />
        </MDXWrapper>
      </motion.article>
    </div>
  );
}

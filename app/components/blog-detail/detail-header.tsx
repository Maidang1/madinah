import { Outlet } from '@remix-run/react';
import { motion } from 'motion/react';
import type { ReadTimeResults } from "reading-time"


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
        className='prose dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-3xl sm:prose-h1:text-4xl prose-h1:mb-6 prose-img:rounded-xl prose-img:shadow-lg'
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
                className='bg-gradient-to-r from-primary/5 to-primary/10 border-l-4 border-primary p-6 rounded-r-lg mb-8 not-prose'
              >
                <div className='flex items-start gap-3'>
                  <div className='bg-primary/10 p-2 rounded-lg text-primary'>
                    <span className='i-lucide-sparkles w-5 h-5 block' />
                  </div>
                  <div>
                    <h3 className='font-medium text-lg flex items-center gap-2 mb-2'>
                      <span>AI 摘要</span>
                      <span className='text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full'>
                        Beta
                      </span>
                    </h3>
                    <p className='text-muted-foreground text-sm leading-relaxed'>
                      {summary}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </header>
        )}
        <div className='mt-8 pb-[800px]'>
          <Outlet />
        </div>
      </motion.article>
    </div>
  );
}

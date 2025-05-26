import { PostInfo } from '~/types';
import { Link } from '@remix-run/react';
import dayjs from 'dayjs';
import { motion } from 'motion/react';
import { cn } from '~/lib/utils';

interface BaseBlogListProps {
  list: PostInfo[];
}

export default function BaseBlogList({ list }: BaseBlogListProps) {
  return (
    <div className='mx-auto pt-[60px] sm:pt-[100px] max-w-4xl px-4 sm:px-6'>
      <div className='grid gap-6 md:gap-8'>
        {(list as PostInfo[]).map((li, index) => (
          <motion.div
            key={li.filename}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            whileHover={{ scale: 1.01 }}
            className='group'
          >
            <Link
              to={li.url}
              className={cn(
                'block no-underline text-foreground',
                'transition-all duration-300 rounded-xl overflow-hidden',
                'border border-border/50 bg-card/50 hover:bg-card/80',
                'shadow-sm hover:shadow-md',
                'transform hover:-translate-y-0.5'
              )}
            >
              <div className='p-6 sm:p-8'>
                <h3 className='text-xl font-semibold mb-2 group-hover:text-primary transition-colors'>{li.title}</h3>
                {li.summary && (
                  <p className='text-muted-foreground mb-4 line-clamp-2'>{li.summary}</p>
                )}
                <div className='flex flex-wrap items-center gap-4 text-sm text-muted-foreground'>
                  <span className='flex items-center'>
                    <span className='i-lucide-calendar-days mr-1.5 w-4 h-4' />
                    {dayjs(li.time).format('YYYY-MM-DD')}
                  </span>
                  {li.tags?.length > 0 && (
                    <div className='flex flex-wrap items-center gap-2'>
                      <span className='i-lucide-tag mr-1.5 w-4 h-4' />
                      {li.tags.map((tag) => (
                        <span 
                          key={tag} 
                          className="px-2.5 py-1 rounded-full text-xs font-medium
                                    bg-primary/10 text-primary/80 hover:bg-primary/20
                                    transition-colors duration-200"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

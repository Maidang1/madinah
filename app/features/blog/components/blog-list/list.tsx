import { PostInfo } from '~/types';
import { Link } from '@remix-run/react';
import { motion } from 'motion/react';
import { cn } from '~/core/utils';
import { Time } from '~/core/ui/common/time';

interface BaseBlogListProps {
  list: PostInfo[];
}

export default function List({ list }: BaseBlogListProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="grid gap-3 md:gap-4">
        {list.map((li) => {
          return (
            <motion.div key={li.filename}>
              <Link
                to={li.url}
                className={cn(
                  'text-foreground block no-underline opacity-90',
                  'overflow-hidden transition-all duration-200',
                  'flex flex-col sm:flex-row sm:items-center',
                  'gap-1.5 sm:gap-2',
                  'hover:opacity-65',
                )}
              >
                <h3 className="text-lg font-medium transition-colors sm:mb-0">
                  {li.title}
                </h3>
                <div className="text-muted-foreground flex items-center gap-2 text-sm whitespace-nowrap">
                  <Time time={li.gitInfo?.createdAt || li.time} />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

import { PostInfo } from '~/types';
import { Link } from '@remix-run/react';
import { motion } from 'motion/react';
import { cn } from '~/core/utils';
import { Time } from '~/core/ui/common/time';

interface BaseBlogListProps {
  list: PostInfo[];
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 30, filter: 'blur(10px)' },
  show: { 
    opacity: 1, 
    y: 0, 
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: [0.215, 0.61, 0.355, 1] } 
  },
};

export default function List({ list }: BaseBlogListProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col space-y-4"
      >
        {list.map((li) => {
          return (
            <motion.div 
              key={li.filename}
              variants={item}
              className="group"
            >
              <Link to={li.url} className="flex items-baseline justify-between gap-4 no-underline group-hover:opacity-60 transition-opacity">
                <h3 className="text-base font-medium text-foreground tracking-tight">
                  {li.title}
                </h3>
                <div className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                  <Time time={li.gitInfo?.createdAt || li.time} />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

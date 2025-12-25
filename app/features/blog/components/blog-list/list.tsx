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
    <div className="mx-auto max-w-6xl px-4 pt-32 pb-48">
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-12 gap-y-32 md:gap-x-16"
      >
        {list.map((li, index) => {
          const isEven = index % 2 === 0;
          return (
            <motion.div 
              key={li.filename}
              variants={item}
              className={cn(
                "group relative flex flex-col",
                isEven ? "md:col-span-7" : "md:col-span-5 md:mt-32"
              )}
            >
              <Link to={li.url} className="flex flex-col gap-8 no-underline">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-primary uppercase">
                    {li.gitInfo?.createdAt ? new Date(li.gitInfo.createdAt).getFullYear() : '2025'}
                  </span>
                  <div className="h-[1px] flex-1 bg-border/40 group-hover:bg-primary/40 transition-colors" />
                </div>
                
                <h3 className="font-display text-5xl md:text-6xl lg:text-7xl font-medium tracking-tighter leading-[0.85] text-foreground transition-all duration-500 group-hover:translate-x-2">
                  {li.title}
                </h3>
                
                <div className="flex items-center justify-between border-b border-border/40 pb-6">
                   <div className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.2em]">
                    <Time time={li.gitInfo?.createdAt || li.time} />
                  </div>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <motion.span 
                      className="text-[10px] font-bold tracking-widest uppercase text-primary opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300"
                    >
                      Read Entry
                    </motion.span>
                    <div className="h-10 w-10 rounded-full border border-border flex items-center justify-center group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                      <span className="text-sm">→</span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

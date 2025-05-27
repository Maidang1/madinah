import { PostInfo } from "~/types";
import { Link } from "@remix-run/react";
import dayjs from "dayjs";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { Time } from "./time";

interface BaseBlogListProps {
  list: PostInfo[];
}

export default function BaseBlogList({ list }: BaseBlogListProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-[60px] sm:px-6 sm:pt-[100px]">
      <div className="grid gap-6 md:gap-8">
        {list.map((li, index) => (
          <motion.div
            key={li.filename}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            whileHover={{ scale: 1.01 }}
          >
            <Link to={li.url}
              className={cn(
                'block no-underline text-foreground',
                'transition-all duration-300 rounded-xl overflow-hidden',
                'hover:bg-black/10 dark:hover:bg-white/20',
                'transform hover:-translate-y-0.5',
                'px-3 py-4 sm:p-6'
              )}
            >
              <h3 className="mb-2 text-2xl font-medium transition-colors">
                {li.title}
              </h3>
              <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                <Time time={li.time} />
                {li.tags?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="i-simple-line-icons-tag h-3 w-3" />
                    {li.tags.map((tag) => (
                      <span
                        key={tag}
                        className="transition-colors duration-200 hover:underline"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

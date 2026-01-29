import { PostInfo } from '~/types';
import { Link } from '@remix-run/react';
import { cn } from '~/core/utils';
import { Time } from '~/core/ui/common/time';

interface BaseBlogListProps {
  list: PostInfo[];
}

export default function List({ list }: BaseBlogListProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      {list.map((li) => {
        return (
          <Link
            key={li.filename}
            to={li.url}
            className="bg-surface-white border-border-default group block rounded-xl border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <article className="space-y-3">
              <h3 className="text-text-primary font-sans text-xl font-bold tracking-tight transition-colors group-hover:text-blue-600">
                {li.title}
              </h3>

              {li.summary && (
                <p className="text-text-secondary line-clamp-2 text-sm leading-relaxed">
                  {li.summary}
                </p>
              )}

              <div className="text-text-muted flex items-center gap-3 text-xs font-medium">
                <Time time={li.gitInfo?.createdAt || li.time} />
                <span>·</span>
                <span>{Math.ceil(li.readingTime?.minutes || 5)} min read</span>
                {li.author && (
                  <>
                    <span>·</span>
                    <span>{li.author}</span>
                  </>
                )}
              </div>
            </article>
          </Link>
        );
      })}
    </div>
  );
}

import { PostInfo } from '~/types';
import { Link } from '@remix-run/react';
import { cn } from '~/core/utils';
import { Time } from '~/core/ui/common/time';

interface BaseBlogListProps {
  list: PostInfo[];
}

export default function List({ list }: BaseBlogListProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-col space-y-4">
        {list.map((li) => {
          return (
            <div 
              key={li.filename}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

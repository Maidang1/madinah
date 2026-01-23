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
      <div className="flex flex-col space-y-2">
        {list.map((li) => {
          return (
            <div key={li.filename} className="group">
              <Link
                to={li.url}
                className="hover:bg-surface-gray-100 hover:border-border-strong focus-visible:ring-text-primary/20 flex cursor-pointer items-center justify-between gap-4 rounded-md px-4 py-3 no-underline transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <h3 className="text-text-primary text-base font-medium tracking-tight transition-colors">
                  {li.title}
                </h3>
                <div className="text-text-muted font-mono text-xs whitespace-nowrap">
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

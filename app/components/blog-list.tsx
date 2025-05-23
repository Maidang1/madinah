import { PostInfo } from '~/types';
import { Link } from '@remix-run/react';
import dayjs from 'dayjs';

interface BaseBlogListProps {
  list: PostInfo[];
}

export default function BaseBlogList({ list }: BaseBlogListProps) {
  return (
    <div className='mx-auto text-white pt-[60px] sm:pt-[100px] prose'>
      {(list as PostInfo[]).map((li) => {
        return (
          <Link
            to={li.url}
            key={li.filename}
            className='no-underline text-[#3c3c43] dark:text-[#fffffff2]'
          >
            <div className='flex flex-col justify-between px-3 sm:px-4 py-4 sm:py-6 rounded-lg gap-y-2 sm:gap-y-4 dark:hover:bg-[rgb(33,33,33)]/75 hover:bg-[rgba(31,35,41,0.05)]'>
              <div className='text-lg sm:text-xl'>{li.title}</div>
              <div className='text-xs sm:text-sm dark:text-white/80 text-[#3c3c43] flex flex-wrap items-center gap-x-1 gap-y-1'>
                <span>{dayjs(li.time).format('YYYY-MM-DD')}</span>
                <span className='flex flex-wrap items-center gap-x-1 gap-y-1'>
                  {li.tags.map((tag) => (
                    <span key={tag} className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-sm"># {tag}</span>
                  ))}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

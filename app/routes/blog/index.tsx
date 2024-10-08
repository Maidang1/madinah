// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
// eslint-disable-next-line import/no-unresolved
import { list } from 'virtual:blog-list';
import { PostInfo } from '~/types';
import { Link } from '@remix-run/react';
import dayjs from 'dayjs';

export default function BlogList() {
  return (
    <div className='mx-auto text-white pt-[100px]'>
      {(list as PostInfo[]).map((li) => {
        return (
          <Link to={li.url} key={li.filename} className="no-underline text-white">
            <div className='flex flex-col justify-between px-4 py-6 rounded-lg gap-y-4 hover:bg-[rgb(33,33,33)]/75'>
              <div className='text-xl'>{li.title}</div>
              <div className='text-xs text-white/80 flex items-center gap-x-1'>
                <span className='i-simple-icons-showtime'></span>
                <span>{dayjs(li.time).format('YYYY-MM-DD')}</span>
                <span className='flex items-center gap-x-1'>
                  {li.tags.map(tag => <span key={tag}># {tag}</span>)}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

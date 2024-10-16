// eslint-disable-next-line import/no-unresolved
import { list } from 'virtual:rust-list';
import { PostInfo } from '~/types';
import { Link } from '@remix-run/react';
import dayjs from 'dayjs';

export default function BlogList() {
  return (
    <div className='mx-auto text-white pt-[100px] prose'>
      {(list as PostInfo[]).map((li) => {
        return (
          <Link to={li.url} key={li.filename} className="no-underline text-[#3c3c43] dark:text-[#fffffff2]">
            <div className='flex flex-col justify-between px-4 py-6 rounded-lg gap-y-4 dark:hover:bg-[rgb(33,33,33)]/75 hover:bg-[rgba(31,35,41,0.05)]'>
              <div className='text-xl'>{li.title}</div>
              <div className='text-xs dark:text-white/80 text-[#3c3c43] flex items-center gap-x-1'>
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

import {
  Outlet,
  ScrollRestoration,
  useLocation,
  NavLink,
} from '@remix-run/react';
import { useState } from 'react';
import { PostInfo } from '~/types';

interface BlogsDetailProps {
  list: PostInfo[];
}

export default function BlogsDetail({ list }: BlogsDetailProps) {
  const { pathname } = useLocation();
  const listItem = list.find((listItem) => listItem.url === pathname);
  const tocs = listItem?.toc ?? [];
  const title = listItem?.title;
  const summary = listItem?.summary;
  const [activeUrl, setActiveUrl] = useState('');

  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
    url: string
  ) => {
    e.preventDefault();
    setActiveUrl(url);
    const targetElement = document.getElementById(url.slice(1));
    const scrollContainer = document.querySelector('.scroll-container');

    if (targetElement && scrollContainer) {
      const elementPosition = targetElement.getBoundingClientRect().top;
      const offsetPosition = elementPosition + scrollContainer.scrollTop - 120;
      if (!scrollContainer) return;
      scrollContainer.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className='container mx-auto mt-4 pt-6 sm:pt-12'>
      <ScrollRestoration />
      <div className='flex flex-wrap justify-center'>
        <div className='w-full lg:w-2/12 pr-4 text-left pt-4 sm:pt-10 sidebar hidden lg:block sticky top-[4.5rem]'>
          <div className='block overflow-y-auto pb-4 border-r border-l-border dark:border-d-border opacity-85'>
            <div className='mb-6'>
              <ul className='block flex-wrap list-none pl-0 mb-0 mt-0 prose'>
                {tocs.map((toc) => (
                  <li key={toc.url} className="mb-1">
                    <NavLink
                      className={`text-base block mx-4 no-underline dark:text-[#fffff5db] text-[#3c3c43] hover:!text-[#646cff] ${
                        activeUrl === toc.url ? '!text-[#646cff]' : ''
                      }`}
                      to={toc.url}
                      onClick={(e) => {
                        handleClick(e, toc.url);
                      }}
                    >
                      <span className='text-sm'>{toc.value}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className='w-full lg:w-8/12 px-4 sm:px-6 lg:px-4'>
          <div className='my-4 sm:my-8'>
            <div className='prose dark:prose-invert max-w-none'>
              <h1 className='text-2xl sm:text-3xl text-center w-full mb-6'>{title}</h1>
              {summary && (
                <div className='my-4 text-sm text-[#3c3c43] dark:text-[#fffffff2]'>
                  <div
                    data-hide-print='true'
                    className='space-y-2 rounded-xl border border-slate-200 p-4 dark:border-neutral-800'
                  >
                    <div className='flex items-center mb-2'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        width='0.99em'
                        height='1em'
                        viewBox='0 0 256 260'
                        fill='currentColor'
                        className='mr-2'
                      >
                        <path d='M250 76.42v155.94a14.17 14.17 0 0 1-14.23 14.14h-216A14.17 14.17 0 0 1 6 232.36V27.64A14.17 14.17 0 0 1 20.23 13.5h167.51a7.06 7.06 0 0 1 4.86 1.93l58.63 58.63a6.8 6.8 0 0 1 1.93 4.86' />
                      </svg>
                      <span className='text-base font-bold'>AI Summary</span>
                    </div>
                    <div className='overflow-hidden'>
                      <div className='overflow-hidden'>
                        <div className='!m-0 text-sm leading-loose text-[#3c3c43] dark:text-[#fffffff2]'>
                          {summary}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className='mt-8'>
                <Outlet />
              </div>
            </div>
          </div>
        </div>
        <div className='w-full lg:w-2/12 px-4 hidden lg:block' />
      </div>
    </div>
  );
}

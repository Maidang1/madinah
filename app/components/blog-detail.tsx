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
    <div className='container mx-auto mt-4 pt-12'>
      <ScrollRestoration />
      <div className='flex flex-wrap justify-center'>
        <div className='w-full lg:w-2/12 pr-4 tex-left pt-10 sidebar hidden lg:block'>
          <div className='block overflow-y-auto pt-8 pb-4 border-r-1 border-l-border dark:border-d-border sticky top-8 opacity-85'>
            <div className='mb-6'>
              <ul className='block flex-wrap list-none pl-0 mb-0 mt-0 prose'>
                {tocs.map((toc) => (
                  <li key={toc.url}>
                    <NavLink
                      className={`text-lg block mb-2 mx-4 no-underline dark:text-[#fffff5db] text-[#3c3c43] hover:!text-[#646cff] ${
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
        <div className='w-full sm:w-9/12 lg:w-8/12 px-4 sm:pr-10 lg:pr-4 ml-4 contents'>
          <div className='my-8'>
            <div className='prose dark:prose-invert max-w-3xl'>
              <h1 className='prose-h1 text-center w-full'>{title}</h1>
              <div className='my-4 text-sm text-[#3c3c43] dark:text-[#fffffff2]'>
                <div
                  data-hide-print='true'
                  className='space-y-2 rounded-xl border border-slate-200 p-4 dark:border-neutral-800'
                >
                  <div className='flex items-center'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      width='0.99em'
                      height='1em'
                      viewBox='0 0 256 260'
                      fill='currentColor'
                      className='mr-2'
                    >
                      <path d='M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87l51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921l51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272l-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695l-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69l-1.535-.922l-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87l-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58L128.067 97.3l28.188 16.218v32.434l-28.086 16.218l-28.188-16.218l-.052-32.434Z'></path>
                    </svg>
                    <span className='text-base font-bold'>AI Summary</span>
                  </div>
                  <div className='overflow-hidden'>
                    <div className='overflow-hidden'>
                      <div className='!m-0 text-sm leading-loose  text-[#3c3c43] dark:text-[#fffffff2]'>
                        {summary}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <Outlet />
            </div>
          </div>
        </div>
        <div className='w-full lg:w-2/12 px-4 hidden lg:block' />
      </div>
    </div>
  );
}

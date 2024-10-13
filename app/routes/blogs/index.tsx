import { Outlet, ScrollRestoration, useLocation, NavLink } from '@remix-run/react';
import { useState } from 'react';
// eslint-disable-next-line import/no-unresolved
import { list } from 'virtual:blog-list';

export default function Blogs() {

  const { pathname } = useLocation()
  const tocs = list.find(listItem => listItem.url === pathname)?.toc ?? []
  const [activeUrl, setActiveUrl] = useState('')

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, url: string) => {
    e.preventDefault()
    setActiveUrl(url)
    const targetElement = document.getElementById(url.slice(1));
    const scrollContainer = document.querySelector('.scroll-container')

    if (targetElement && scrollContainer) {
      const elementPosition = targetElement.getBoundingClientRect().top
      const offsetPosition = elementPosition + scrollContainer.scrollTop - 120;
      if (!scrollContainer) return
      scrollContainer.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }

  }

  return (
    <div className="container mx-auto mt-4 pt-12">
      <ScrollRestoration />
      <div className="flex flex-wrap justify-center">
        <div className="w-full lg:w-2/12 pr-4 tex-left pt-10 sidebar hidden lg:block">
          <div className="block overflow-y-auto pt-8 pb-4 border-r-1 border-l-border dark:border-d-border sticky top-8 opacity-85">
            <div className="mb-6">
              <ul className="block flex-wrap list-none pl-0 mb-0 mt-0 prose">
                {tocs.map(toc => (
                  <li key={toc.url}>
                    <NavLink
                      className={`text-lg block mb-2 mx-4 no-underline dark:text-[#fffff5db] text-[#3c3c43] hover:!text-[#646cff] ${activeUrl === toc.url ? "!text-[#646cff]" : ""}`}
                      to={toc.url}
                      onClick={(e) => { handleClick(e, toc.url) }}
                    >
                      <span className='text-sm'>
                        {toc.value}
                      </span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="w-full sm:w-9/12 lg:w-8/12 px-4 sm:pr-10 lg:pr-4 ml-4 contents">
          <div className="my-8">
            <div className="prose dark:prose-invert max-w-3xl">
              <Outlet />
            </div>
          </div>
        </div>
        <div className="w-full lg:w-2/12 px-4 hidden lg:block" />
      </div>
    </div>
  );
}



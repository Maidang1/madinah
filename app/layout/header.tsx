import { Link } from '@remix-run/react';
import { useEffectOnce, useLocalStorage } from 'react-use';
import { Name } from './name';
import { useState } from 'react';

import { MoonIcon, SunIcon } from "lucide-react"
const tabs = [
  {
    text: 'Blog',
    link: '/blog',
  },
  // {
  //   text: 'Projects',
  //   link: '/projects',
  // },
  {
    text: 'Rust',
    link: '/rust',
  },
];
const Header = () => {
  const [localDark, setLocalDark] = useLocalStorage(
    'madinah_blog_theme',
    false
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffectOnce(() => {
    if (localDark) {
      const root = document.documentElement;
      root.classList.add('dark');
    }
  });

  useEffectOnce(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');

    const handleThemeChange = (event: MediaQueryListEvent) => {
      setLocalDark(event.matches);
      document.documentElement.classList.toggle('dark');
    };

    query.addEventListener('change', handleThemeChange);

    return () => {
      query.removeEventListener('change', handleThemeChange);
    };
  });

  const toggleTheme = () => {
    setLocalDark(!localDark);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className='flex justify-between items-center px-4 sm:px-8 py-3 sm:py-4 fixed left-0 right-0 z-50 dark:bg-[rgb(24,23,23)] bg-white shadow-xs'>
      <div className='flex items-center'>
        <Link
          to='/'
          className='flex gap-x-2 items-center text-[#3c3c43] dark:text-[#fffffff2]'
        >
          <span className="hidden sm:block">
            <Name />
          </span>
          <img
            src='https://avatars.githubusercontent.com/u/50993231?v=4'
            alt='avatar'
            className='w-6 h-6 rounded-sm'
          />
        </Link>
      </div>

      {/* Mobile menu button */}
      <button
        className="lg:hidden text-[#3c3c43] dark:text-[#fffffff2]"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        {isMenuOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Desktop menu */}
      <div className='hidden lg:flex items-center'>
        {tabs.map((item) => (
          <div key={item.text} className='mr-4 last:mr-0'>
            <Link to={item.link}>
              <span className='text-[#3c3c43] dark:text-[#fffffff2] opacity-70 hover:opacity-100 duration-75'>
                {item.text}
              </span>
            </Link>
          </div>
        ))}
        <div
          className='mr-4 last:mr-0 cursor-pointer flex items-center text-xl text-[#3c3c43] dark:text-[#fffffff2] opacity-70 hover:opacity-100'
          onClick={toggleTheme}
        >
          {localDark ? <SunIcon size={20} /> : <MoonIcon size={20} />}
        </div>
      </div>

      {/* Mobile menu */}
      <div 
        className={`lg:hidden fixed inset-x-0 top-[53px] bg-white dark:bg-[rgb(24,23,23)] shadow-lg transition-all duration-300 ease-in-out transform ${
          isMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0 pointer-events-none'
        }`}
      >
        <div className="px-4 py-3 space-y-1">
          {tabs.map((item) => (
            <div 
              key={item.text} 
              className="active:bg-gray-100 dark:active:bg-gray-800 rounded-lg"
            >
              <Link 
                to={item.link}
                onClick={() => setIsMenuOpen(false)}
                className="block py-3 px-4"
              >
                <span className='text-[#3c3c43] dark:text-[#fffffff2] opacity-70 hover:opacity-100 duration-150 text-lg'>
                  {item.text}
                </span>
              </Link>
            </div>
          ))}
          <div
            className='rounded-lg active:bg-gray-100 dark:active:bg-gray-800'
            onClick={() => {
              toggleTheme();
              setIsMenuOpen(false);
            }}
          >
            <div className="py-3 px-4 cursor-pointer">
              <span className="flex items-center gap-x-3 text-[#3c3c43] dark:text-[#fffffff2] opacity-70 hover:opacity-100">
                {localDark ? (
                  <>
                    <SunIcon size={20} />
                    <span className="text-lg">Light Mode</span>
                  </>
                ) : (
                  <>
                    <MoonIcon size={20} />
                    <span className="text-lg">Dark Mode</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;

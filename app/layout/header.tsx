import { Link } from '@remix-run/react';
import { useEffectOnce, useLocalStorage } from 'react-use';
import { Name } from './name';

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
    <div className='flex justify-between px-8 py-4 fixed left-0 right-0 z-50 dark:bg-[rgb(24,23,23)] bg-white'>
      <div className=''>
        <Link
          to='/'
          className='flex gap-x-2 items-center text-[#3c3c43] dark:text-[#fffffff2]'
        >
          <span>
            <Name />
          </span>
          <img
            src='https://avatars.githubusercontent.com/u/50993231?v=4'
            alt='avatar'
            className='w-6 h-6 rounded'
          />
        </Link>
      </div>
      <div className='flex items-center'>
        {tabs.map((item) => (
          <div key={item.text} className='mr-4 last:mr-0'>
            <Link to={item.link}>
              {
                <span className='text-[#3c3c43] dark:text-[#fffffff2]'>
                  {item.text}
                </span>
              }
            </Link>
          </div>
        ))}
        <div
          className='mr-4 last:mr-0 cursor-pointer flex items-center text-xl text-[#3c3c43] dark:text-[#fffffff2]'
          onClick={toggleTheme}
        >
          <span className='i-simple-icons-sunrise dark:i-simple-icons-icomoon' />
        </div>
      </div>
    </div>
  );
};

export default Header;

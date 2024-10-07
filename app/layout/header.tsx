import { Link } from '@remix-run/react';
import { useEffectOnce, useLocalStorage } from "react-use"



const tabs = [
  {
    text: 'Blog',
    link: '/blog',
  },
  {
    text: 'Projects',
    link: '/projects',
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

  const toggleTheme = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setLocalDark(!localDark);
    const isAppearanceTransition =
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      document.startViewTransition &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isAppearanceTransition) {
      document.documentElement.classList.toggle('dark');
      return;
    }
    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y)
    );
    let isDarkMode = false;
    const transition = document.startViewTransition(() => {
      const root = document.documentElement;
      isDarkMode = root.classList.contains('dark');
      root.classList.toggle('dark');
    });
    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];
      document.documentElement.animate(
        {
          clipPath: isDarkMode ? [...clipPath].reverse() : clipPath,
        },
        {
          duration: 400,
          easing: 'ease-out',
          pseudoElement: isDarkMode
            ? '::view-transition-old(root)'
            : '::view-transition-new(root)',
        }
      );
    });
  };
  return (
    <div
      className='flex justify-between px-8 py-4 fixed left-0 right-0 text-white/70 z-50 bg-transparent'
    >
      <div className='opacity-50 hover:opacity-80 dark:opacity-90 dark:hover:opacity-100'>
        <a href='/' className='flex gap-x-2 items-center'>
          <span>Madinah</span>
          <img src="https://avatars.githubusercontent.com/u/50993231?v=4" alt="avatar" className='w-6 h-6 rounded' />
        </a>
      </div>
      <div className='flex items-center'>
        {tabs.map((item) => (
          <div
            key={item.text}
            className='mr-4 opacity-50 hover:opacity-80 last:mr-0 dark:opacity-90 dark:hover:opacity-100'
          >
            <Link to={item.link}>{item.text}</Link>
          </div>
        ))}
        <div
          className=' mr-4 opacity-50 hover:opacity-80 last:mr-0 dark:opacity-90 dark:hover:opacity-100 cursor-pointer flex items-center text-xl'
          onClick={toggleTheme}
        >
          <span className='i-circum-light dark:i-circum-dark' />
        </div>
      </div>
    </div>
  );
};

export default Header;

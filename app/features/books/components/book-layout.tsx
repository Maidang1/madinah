import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { cn } from '~/core/utils';

interface BookLayoutProps {
  sidebar: (close: () => void) => ReactNode;
  children: ReactNode;
  overview?: (close: () => void) => ReactNode;
}

export function BookLayout({ sidebar, overview, children }: BookLayoutProps) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const sidebarId = useId();
  const overlayId = useId();

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSidebar();
      }
    };

    window.addEventListener('keydown', handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeSidebar, isSidebarOpen]);

  const sidebarClasses = useMemo(
    () =>
      cn(
        'fixed inset-y-0 left-0 z-50 w-80 transform bg-white shadow-xl transition-transform duration-300 ease-in-out dark:bg-zinc-900 xl:hidden',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ),
    [isSidebarOpen],
  );

  const overlayClasses = useMemo(
    () =>
      cn(
        'fixed inset-0 z-40 bg-black/30 transition-opacity xl:hidden',
        isSidebarOpen
          ? 'opacity-100 backdrop-blur'
          : 'pointer-events-none opacity-0',
      ),
    [isSidebarOpen],
  );

  const renderedSidebar = useMemo(
    () => sidebar(closeSidebar),
    [closeSidebar, sidebar],
  );

  const renderedOverview = useMemo(
    () => (overview ? overview(closeSidebar) : null),
    [closeSidebar, overview],
  );

  return (
    <div className="relative">
      <div
        id={sidebarId}
        aria-hidden={!isSidebarOpen}
        className={sidebarClasses}
      >
        <div className="flex h-full flex-col gap-6 overflow-y-auto p-6 pb-20">
          {renderedOverview}
          {renderedSidebar}
        </div>
        <button
          type="button"
          aria-controls={sidebarId}
          className="focus-visible:ring-main-500 absolute top-4 right-4 rounded-full p-2 text-gray-500 transition hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus-visible:ring-2"
          onClick={closeSidebar}
        >
          <span className="sr-only">关闭章节导航</span>
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <button
        id={overlayId}
        type="button"
        aria-controls={sidebarId}
        aria-hidden={!isSidebarOpen}
        className={overlayClasses}
        onClick={closeSidebar}
      >
        <span className="sr-only">关闭章节导航</span>
      </button>

      <button
        type="button"
        aria-controls={sidebarId}
        aria-expanded={isSidebarOpen}
        className="focus-visible:ring-main-500 fixed top-4 left-4 z-30 rounded-md bg-white p-2 opacity-70 shadow-md transition hover:opacity-100 focus:outline-none focus-visible:ring-2 xl:hidden"
        onClick={openSidebar}
      >
        <span className="sr-only">打开章节导航</span>
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <div className="relative mx-auto w-full max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
        <div className="relative grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-10">
            <div className="grid gap-6 xl:hidden">
              {renderedOverview}
            </div>
            {children}
          </div>

          <aside className="relative hidden xl:block">
            <div className="sticky top-28 flex max-h-[calc(100vh-7rem)] flex-col gap-6">
              {renderedOverview}
              <div className="flex-1 overflow-y-auto pr-1">
                {renderedSidebar}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

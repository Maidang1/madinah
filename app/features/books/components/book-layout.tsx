import type { ReactNode } from 'react';
import type { BookSummaryInfo } from '~/types';

interface BookLayoutProps {
  book: BookSummaryInfo;
  sidebar: ReactNode;
  children: ReactNode;
  overview?: ReactNode;
}

export function BookLayout({
  book,
  sidebar,
  overview,
  children,
}: BookLayoutProps) {
  return (
    <div className="relative h-full max-h-full overflow-hidden">
      {/* Mobile Overlay Sidebar */}
      <div
        className="fixed inset-y-0 left-0 z-50 w-80 -translate-x-full transform bg-white shadow-xl transition-transform duration-300 ease-in-out lg:hidden"
        id="mobile-sidebar"
      >
        <div
          className="h-full space-y-6 overflow-y-auto p-6"
          onClick={(e) => {
            // 检查点击的是否是链接元素
            const target = e.target as HTMLElement;
            const link = target.closest('a');
            if (link) {
              // 如果点击的是链接，隐藏侧边栏
              const sidebar = document.getElementById('mobile-sidebar');
              const overlay = document.getElementById('mobile-overlay');
              sidebar?.classList.add('-translate-x-full');
              overlay?.classList.add('hidden');
            }
          }}
        >
          {overview}
          {sidebar}
        </div>
        {/* Close button */}
        <button
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700"
          onClick={() => {
            const sidebar = document.getElementById('mobile-sidebar');
            const overlay = document.getElementById('mobile-overlay');
            sidebar?.classList.add('-translate-x-full');
            overlay?.classList.add('hidden');
          }}
        >
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

      {/* Mobile Overlay Background */}
      <div
        className="bg-opacity-20 fixed inset-0 z-40 hidden bg-white lg:hidden"
        id="mobile-overlay"
        onClick={() => {
          const sidebar = document.getElementById('mobile-sidebar');
          const overlay = document.getElementById('mobile-overlay');
          sidebar?.classList.add('-translate-x-full');
          overlay?.classList.add('hidden');
        }}
      ></div>

      {/* Mobile Menu Button */}
      <button
        className="fixed top-4 left-4 z-30 rounded-md bg-white p-2 opacity-60 shadow-md lg:hidden"
        onClick={() => {
          const sidebar = document.getElementById('mobile-sidebar');
          const overlay = document.getElementById('mobile-overlay');
          sidebar?.classList.remove('-translate-x-full');
          overlay?.classList.remove('hidden');
        }}
      >
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

      {/* Desktop Layout */}
      <div className="hidden h-full max-h-full gap-8 overflow-hidden lg:grid lg:grid-cols-[minmax(260px,320px)_1fr]">
        <div className="sticky top-0 h-screen space-y-6 overflow-y-auto">
          {overview}
          {sidebar}
        </div>
        <div className="h-full max-h-full space-y-6 overflow-auto">
          {children}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="h-full max-h-full overflow-auto lg:hidden">
        <div className="px-4 pt-16">{children}</div>
      </div>
    </div>
  );
}

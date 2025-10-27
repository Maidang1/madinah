import { render } from '@testing-library/react';
import { vi } from 'vitest';
import Detail from './detail';
import type { PostInfo } from '~/types';
import { resizeViewport, setReducedMotionPreference } from '~/../tests/utils/viewport';
import { act } from 'react';

const posts: PostInfo[] = [
  {
    title: 'Accessible Article',
    summary: 'Summary focused on ensuring accessibility coverage.',
    tags: ['accessibility'],
    time: new Date(2024, 5, 8).toISOString(),
    date: new Date(2024, 5, 8).toISOString(),
    readingTime: { minutes: 6, words: 1500 },
    filename: 'accessible-article',
    url: '/blogs/accessible-article',
    toc: [],
    content: '<p>Accessible content</p>',
    status: 'ready',
    author: 'A11y Tester',
  },
];

vi.mock('~/core/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'en',
  }),
}));

vi.mock('@remix-run/react', () => ({
  ScrollRestoration: () => null,
  useLocation: () => ({ pathname: posts[0].url }),
  Outlet: () => <div data-testid="mdx-slot">MDX Body</div>,
}));

vi.mock('./blog-navigation', () => ({
  BlogNavigation: () => <nav data-testid="blog-navigation" />,
}));

vi.mock('./scroll-to-top', () => ({
  ScrollToTopButton: () => <button type="button" data-testid="scroll-top" />,
}));

vi.mock('./table-contents-mobile', () => ({
  TableOfContentsMobile: () => <aside data-testid="toc-mobile" />,
}));

vi.mock('./table-contents-pc', () => ({
  TableOfContentsPC: () => <nav data-testid="toc-desktop" />,
}));

describe('Blog detail accessibility', () => {
  it('disables sticky header transitions when reduced motion is preferred', async () => {
    setReducedMotionPreference(true);
    resizeViewport(1440, 900);

    let view: ReturnType<typeof render>;
    await act(async () => {
      view = render(<Detail list={posts} />);
      await Promise.resolve();
    });
    const { container } = view!;

    const stickyHeader = container.querySelector('[data-testid="blog-detail-sticky-header"]');
    expect(stickyHeader).toBeTruthy();
    expect(stickyHeader?.className ?? '').toContain('transition-none');

    const sidebar = container.querySelector('[data-testid="blog-detail-sidebar"]');
    expect(sidebar).toBeTruthy();
    expect(sidebar?.className ?? '').toContain('transition-none');
  });

  afterEach(() => {
    setReducedMotionPreference(false);
  });
});

import { render } from '@testing-library/react';
import { act } from 'react';
import { vi } from 'vitest';
import Detail from './detail';
import type { PostInfo } from '~/types';
import { resizeViewport, setReducedMotionPreference } from '~/../tests/utils/viewport';

const posts: PostInfo[] = [
  {
    title: 'Sample Article',
    summary: 'A long-form article summary for layout testing.',
    tags: ['design', 'layout'],
    time: new Date(2024, 3, 15).toISOString(),
    date: new Date(2024, 3, 15).toISOString(),
    readingTime: { minutes: 7, words: 1800 },
    filename: 'sample-article',
    url: '/blogs/sample-article',
    toc: [],
    content: '<p>Example content</p>',
    status: 'ready',
    author: 'Layout Tester',
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

describe('Blog detail layout', () => {
  it('constrains MDX content to the reading measure', async () => {
    resizeViewport(1440, 900);
    setReducedMotionPreference(false);
    let view: ReturnType<typeof render>;
    await act(async () => {
      view = render(<Detail list={posts} />);
      await Promise.resolve();
    });
    const { container } = view!;

    const mdxContent = container.querySelector('.mdx-content');
    expect(mdxContent).toBeTruthy();
    expect(mdxContent?.className).toContain('max-w-[--reading-measure]');
  });
});

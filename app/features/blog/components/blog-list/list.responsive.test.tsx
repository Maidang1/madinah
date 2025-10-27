import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { act } from 'react';
import { vi } from 'vitest';
import List from './list';
import type { PostInfo } from '~/types';
import { resizeViewport, setReducedMotionPreference } from '~/../tests/utils/viewport';

vi.mock('~/core/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'en',
  }),
}));

vi.mock('@remix-run/react', () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const createPost = (index: number, overrides: Partial<PostInfo> = {}): PostInfo => {
  const baseDate = new Date(2024, 0, index + 1).toISOString();
  return {
    title: `Post ${index + 1}`,
    summary: 'A concise summary for testing responsive density.',
    tags: ['testing', 'responsive'],
    time: baseDate,
    date: baseDate,
    readingTime: { minutes: 5, words: 1200 },
    filename: `post-${index + 1}`,
    url: `/blog/post-${index + 1}`,
    toc: [],
    content: '',
    status: 'ready',
    author: 'Test Author',
    ...overrides,
  };
};

const posts = Array.from({ length: 6 }, (_, index) => createPost(index));

describe('BlogList responsive layout', () => {
  beforeEach(() => {
    resizeViewport(360, 780);
    setReducedMotionPreference(false);
  });

  it('uses compact spacing tokens at 360px width', async () => {
    await act(async () => {
      render(<List list={posts} />);
      await Promise.resolve();
    });

    const container = screen.getByTestId('blog-list-container');
    expect(container).toHaveClass('px-inline-sm');

    const grid = screen.getByTestId('blog-list-grid');
    expect(grid).toHaveClass('gap-y-stack-md');

    const cards = screen.getAllByRole('link');
    expect(cards.length).toBe(posts.length);
    cards.forEach((card) => {
      expect(card).toHaveClass('px-inline-sm');
      expect(card).toHaveClass('py-stack-md');
    });
  });

  it('surfaces a two-column grid at ≥1280px', async () => {
    resizeViewport(1280, 900);
    await act(async () => {
      render(<List list={posts} />);
      await Promise.resolve();
    });

    const grid = screen.getByTestId('blog-list-grid');
    expect(grid.className).toContain('lg:grid-cols-2');
    expect(grid.className).toContain('lg:gap-x-inline-md');
  });
});

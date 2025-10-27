import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    summary: 'A concise summary for testing reduced-motion behavior.',
    tags: ['accessibility'],
    time: baseDate,
    date: baseDate,
    readingTime: { minutes: 4, words: 980 },
    filename: `post-${index + 1}`,
    url: `/blog/post-${index + 1}`,
    toc: [],
    content: '',
    status: 'ready',
    author: 'Test Author',
    ...overrides,
  };
};

const posts = Array.from({ length: 3 }, (_, index) => createPost(index));

describe('BlogList accessibility', () => {
  beforeEach(() => {
    resizeViewport(360, 780);
    setReducedMotionPreference(true);
  });

  afterEach(() => {
    setReducedMotionPreference(false);
  });

  it('disables hover transitions when reduced motion is preferred', async () => {
    await act(async () => {
      render(<List list={posts} />);
      await Promise.resolve();
    });

    const firstCard = screen.getAllByRole('link')[0];
    expect(firstCard).toHaveClass('transition-none');
    expect(firstCard.className).not.toContain('duration-300');
  });

  it('respects keyboard navigation order on desktop widths', async () => {
    setReducedMotionPreference(false);
    resizeViewport(1280, 900);
    await act(async () => {
      render(<List list={posts} />);
      await Promise.resolve();
    });

    const [firstCard, secondCard] = screen.getAllByRole('link');

    await userEvent.tab();
    expect(document.activeElement).toBe(firstCard);
    expect(firstCard.className).toContain('focus-visible:outline-primary');

    await userEvent.tab();
    expect(document.activeElement).toBe(secondCard);
  });
});

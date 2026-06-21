import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlogList } from './blog-list';

const { mockFetchMorePosts } = vi.hoisted(() => ({
  mockFetchMorePosts: vi.fn(),
}));

let intersectionCallback:
  | ((entries: Array<{ isIntersecting: boolean }>) => void)
  | undefined;

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span aria-label={alt} role="img" />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('./actions', () => ({
  fetchMorePosts: (...args: unknown[]) => mockFetchMorePosts(...args),
}));

const blogPost = {
  id: 'post-1',
  title: 'Best Phones in Nigeria',
  slug: 'best-phones-in-nigeria',
  excerpt: 'A practical buying guide.',
  featured_image_url: 'https://cdn.example.com/blog/phones.jpg',
  featured_image_alt: 'Phones on a table',
  category: 'Guides',
  tags: ['phones'],
  author_name: 'Ogabassey',
  published_at: '2026-03-28T23:30:00.000Z',
  reading_time_minutes: 4,
  view_count: 10,
};

describe('BlogList', () => {
  beforeEach(() => {
    mockFetchMorePosts.mockReset();
    intersectionCallback = undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(
          callback: (entries: Array<{ isIntersecting: boolean }>) => void
        ) {
          intersectionCallback = callback;
        }
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders published dates with deterministic server/client text', () => {
    render(
      <BlogList
        initialPosts={[blogPost]}
        merchantId="merchant-1"
        totalPosts={1}
        basePath="/ogabassey"
      />
    );

    expect(screen.getByText('28 Mar 2026')).toBeInTheDocument();
    expect(screen.getByText('28 Mar 2026').closest('time')).toHaveAttribute(
      'datetime',
      blogPost.published_at
    );
  });

  it('omits invalid published dates without hiding the post card media', () => {
    render(
      <BlogList
        initialPosts={[{ ...blogPost, published_at: 'not-a-date' }]}
        merchantId="merchant-1"
        totalPosts={1}
        basePath="/ogabassey"
      />
    );

    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
    expect(screen.queryByText('not-a-date')).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Phones on a table' })
    ).toBeInTheDocument();
  });

  it('continues infinite loading from the first server-rendered page', () => {
    mockFetchMorePosts.mockResolvedValueOnce([]);

    render(
      <BlogList
        initialPosts={[blogPost]}
        merchantId="merchant-1"
        totalPosts={48}
        basePath="/ogabassey"
      />
    );

    act(() => {
      intersectionCallback?.([{ isIntersecting: true }]);
    });

    expect(mockFetchMorePosts).toHaveBeenCalledWith(
      'merchant-1',
      2,
      undefined,
      undefined
    );
  });

  it('does not auto-fetch when rendering a paginated crawl page', () => {
    render(
      <BlogList
        initialPosts={[blogPost]}
        initialPage={3}
        merchantId="merchant-1"
        totalPosts={48}
        basePath="/ogabassey"
      />
    );

    act(() => {
      intersectionCallback?.([{ isIntersecting: true }]);
    });

    expect(mockFetchMorePosts).not.toHaveBeenCalled();
  });
});

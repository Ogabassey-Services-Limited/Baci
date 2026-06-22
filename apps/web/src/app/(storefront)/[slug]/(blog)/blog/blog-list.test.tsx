import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BlogList } from './blog-list';

vi.mock('next/image', () => ({
  default: ({ alt, preload }: { alt: string; preload?: boolean }) => (
    <span
      aria-label={alt}
      data-preload={preload ? 'true' : undefined}
      role="img"
    />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
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
  it('renders published dates with deterministic server/client text', () => {
    render(
      <BlogList
        initialPosts={[blogPost]}
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

  it('renders the first visible card image as the listing LCP candidate', () => {
    render(
      <BlogList
        initialPosts={[
          blogPost,
          {
            ...blogPost,
            id: 'post-2',
            slug: 'second-post',
            title: 'Second post',
          },
        ]}
        totalPosts={2}
        basePath="/ogabassey"
      />
    );

    const images = screen.getAllByRole('img');
    expect(images[0]).toHaveAttribute('data-preload', 'true');
    expect(images[1]).not.toHaveAttribute('data-preload');
  });

  it('renders crawlable pagination copy instead of auto-fetching with IntersectionObserver', () => {
    render(
      <BlogList
        initialPosts={[blogPost]}
        totalPosts={48}
        basePath="/ogabassey"
      />
    );

    expect(screen.getByText('Showing 1 of 48 articles')).toBeInTheDocument();
    expect(
      screen.queryByText("You've reached the end")
    ).not.toBeInTheDocument();
  });

  it('does not show pagination copy when rendering a later crawl page', () => {
    render(
      <BlogList
        initialPosts={[blogPost]}
        initialPage={3}
        totalPosts={48}
        basePath="/ogabassey"
      />
    );

    expect(screen.queryByText(/Showing /)).not.toBeInTheDocument();
  });
});

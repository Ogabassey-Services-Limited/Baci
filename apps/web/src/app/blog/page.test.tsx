import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';

const mockGetPlatformBlogListing = vi.fn();

vi.mock('@/lib/platform-blog', () => ({
  PLATFORM_BLOG_CONTEXT: {
    baseUrl: 'https://usebaci.com',
    businessName: 'Baci',
    logoUrl: 'https://usebaci.com/logo.png',
  },
  getPlatformBlogListing: (...args: unknown[]) =>
    mockGetPlatformBlogListing(...args),
}));

vi.mock('@/components/app-body', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/platform/header', () => ({
  PlatformHeader: () => <header>Platform Header</header>,
}));

vi.mock('@/components/platform/footer', () => ({
  PlatformFooter: () => <footer>Platform Footer</footer>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import BlogPage from './page';

describe('platform blog listing page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformBlogListing.mockResolvedValue({
      hasMore: false,
      limit: 12,
      page: 1,
      posts: [],
      total: 0,
      totalPages: 1,
    });
  });

  it('uses the shared listing query and renders the empty state', async () => {
    render(await BlogPage({ searchParams: Promise.resolve({}) }));

    expect(mockGetPlatformBlogListing).toHaveBeenCalledWith({
      limit: BLOG_LISTING_PAGE_SIZE,
      page: 1,
    });
    expect(screen.getByText('Platform Header')).toBeInTheDocument();
    expect(screen.getByText('Platform Footer')).toBeInTheDocument();
    expect(screen.getByText('No posts yet')).toBeInTheDocument();
  });

  it('parses the page number and renders post links and JSON-LD', async () => {
    mockGetPlatformBlogListing.mockResolvedValueOnce({
      hasMore: true,
      limit: 12,
      page: 2,
      posts: [
        {
          author_name: 'Baci Editorial',
          category: 'Guides',
          excerpt: 'How to launch faster.',
          id: 'post-1',
          published_at: '2026-05-16T10:00:00.000Z',
          slug: 'launch-faster',
          title: 'Launch Faster',
        },
      ],
      total: 25,
      totalPages: 3,
    });

    const { container } = render(
      await BlogPage({ searchParams: Promise.resolve({ page: '2' }) })
    );

    expect(mockGetPlatformBlogListing).toHaveBeenCalledWith({
      limit: BLOG_LISTING_PAGE_SIZE,
      page: 2,
    });
    expect(
      screen.getByRole('link', { name: /Launch Faster/i })
    ).toHaveAttribute('href', '/blog/launch-faster');

    const jsonLdScripts = container.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    expect(jsonLdScripts.length).toBe(2);
    expect(jsonLdScripts[0]?.textContent || '').toContain('"@type":"Blog"');
    expect(jsonLdScripts[1]?.textContent || '').toContain(
      '"@type":"BreadcrumbList"'
    );
  });
});

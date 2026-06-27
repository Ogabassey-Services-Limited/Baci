import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetBlogAuthorBySlug, mockGetCachedBlogAuthor, mockRedirect } =
  vi.hoisted(() => ({
    mockGetBlogAuthorBySlug: vi.fn(),
    mockGetCachedBlogAuthor: vi.fn(),
    mockRedirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
  }));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // biome-ignore lint/performance/noImgElement: test stub for next/image
    <img src={src} alt={alt} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  permanentRedirect: (url: string) => {
    throw new Error(`NEXT_PERMANENT_REDIRECT:${url}`);
  },
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock(
  '@/app/(storefront)/[slug]/(blog)/blog/[...catchAll]/blog-catch-all-resolution',
  () => ({ resolveBlogCatchAllOutcome: vi.fn() })
);

vi.mock('@/lib/blog-authors', () => ({
  getBlogAuthorBySlug: (...args: unknown[]) => mockGetBlogAuthorBySlug(...args),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogAuthor: (...args: unknown[]) => mockGetCachedBlogAuthor(...args),
}));

vi.mock('@/lib/routes', () => ({ asRoute: (value: string) => value }));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: (value: unknown) => JSON.stringify(value),
  sanitizeSchemaUrl: (value: string) => value,
}));

vi.mock('@/lib/seo-utils', () => ({
  generateBreadcrumbSchema: () => ({ '@type': 'BreadcrumbList' }),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { custom_domain?: string; slug: string }) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`,
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
}));

import { BlogAuthorPageContent } from './blog-author-page-content';

const authorData = {
  merchant: {
    id: 'm1',
    business_name: 'Ogabassey',
    slug: 'ogabassey',
    logo_url: null,
    custom_domain: 'ogabassey.com',
  },
  author: {
    name: 'Bassey John',
    title: 'Performance Marketing Specialist',
    bio: 'Bassey John writes practical device buying guides.',
    imageUrl: 'https://cdn.ogabassey.com/authors/bassey-john.jpg',
  },
  posts: [
    {
      id: 'p1',
      title: 'Best Phones in Nigeria',
      slug: 'best-phones',
      excerpt: 'Budget and flagship picks.',
      featured_image_url: null,
      featured_image_alt: null,
      category: 'Smartphones',
      published_at: '2026-03-16T10:00:00.000Z',
      reading_time_minutes: 4,
    },
  ],
  totalPosts: 1,
  currentPage: 1,
  totalPages: 1,
};

describe('BlogAuthorPageContent navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBlogAuthorBySlug.mockReturnValue({
      name: 'Bassey John',
      sameAs: [],
    });
    mockGetCachedBlogAuthor.mockResolvedValue(authorData);
  });

  it('renders crawlable pagination and a full-count ItemList for multi-page authors', async () => {
    mockGetCachedBlogAuthor.mockResolvedValue({
      ...authorData,
      totalPosts: 30,
      currentPage: 2,
      totalPages: 3,
    });

    const { container } = render(
      await BlogAuthorPageContent({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          authorSlug: 'bassey-john',
        }),
        searchParams: Promise.resolve({ page: '2' }),
      })
    );

    expect(mockGetCachedBlogAuthor).toHaveBeenCalledWith(
      'ogabassey.com',
      'Bassey John',
      { page: 2 }
    );
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      'https://ogabassey.com/blog/author/bassey-john'
    );
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      'https://ogabassey.com/blog/author/bassey-john?page=3'
    );
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    const itemListScript = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).find((s) => s.textContent?.includes('ItemList'));
    expect(itemListScript?.textContent).toContain('"numberOfItems":30');
    expect(itemListScript?.textContent).toContain('"position":13');
  });

  it('redirects an out-of-range author page to the last valid page', async () => {
    mockGetCachedBlogAuthor.mockResolvedValue({
      ...authorData,
      totalPosts: 30,
      currentPage: 5,
      totalPages: 3,
    });

    await expect(
      BlogAuthorPageContent({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          authorSlug: 'bassey-john',
        }),
        searchParams: Promise.resolve({ page: '5' }),
      })
    ).rejects.toThrow(
      'NEXT_REDIRECT:https://ogabassey.com/blog/author/bassey-john?page=3'
    );
  });

  it('keeps author links canonical without relying on merchant headers', async () => {
    render(
      await BlogAuthorPageContent({
        params: Promise.resolve({
          slug: 'ogabassey',
          authorSlug: 'bassey-john',
        }),
      })
    );

    expect(screen.getByRole('link', { name: /Back to Blog/ })).toHaveAttribute(
      'href',
      'https://ogabassey.com/blog'
    );
    expect(
      screen.getByRole('link', { name: /Best Phones in Nigeria/ })
    ).toHaveAttribute('href', 'https://ogabassey.com/blog/best-phones');
  });
});

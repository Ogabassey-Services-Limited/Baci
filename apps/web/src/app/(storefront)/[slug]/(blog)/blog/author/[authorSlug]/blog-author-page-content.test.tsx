import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetBlogAuthorBySlug, mockGetCachedBlogAuthor, mockNotFound } =
  vi.hoisted(() => ({
    mockGetBlogAuthorBySlug: vi.fn(),
    mockGetCachedBlogAuthor: vi.fn(),
    mockNotFound: vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
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

vi.mock('next/navigation', () => ({ notFound: () => mockNotFound() }));

vi.mock('@/lib/blog-authors', () => ({
  getBlogAuthorBySlug: (...args: unknown[]) => mockGetBlogAuthorBySlug(...args),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogAuthor: (...args: unknown[]) => mockGetCachedBlogAuthor(...args),
}));

vi.mock('@/lib/routes', () => ({ asRoute: (value: string) => value }));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: (value: unknown) => JSON.stringify(value),
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
    bio: 'Bassey John is a Performance Marketing Specialist at Ogabassey.',
    imageUrl:
      'https://cdn.ogabassey.com/merchants/ogabassey/authors/bassey-john.jpg',
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

describe('BlogAuthorPageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBlogAuthorBySlug.mockReturnValue({
      name: 'Bassey John',
      sameAs: [
        'https://www.linkedin.com/in/bassey-john-6a277885',
        'https://x.com/digitalogaa',
      ],
    });
    mockGetCachedBlogAuthor.mockResolvedValue(authorData);
  });

  it('renders the author profile, social links, posts, and a ProfilePage/Person graph', async () => {
    const { container } = render(
      await BlogAuthorPageContent({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          authorSlug: 'bassey-john',
        }),
      })
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Bassey John' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Performance Marketing Specialist at Ogabassey')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Bassey John is a Performance Marketing Specialist/)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/bassey-john-6a277885'
    );
    expect(screen.getByRole('link', { name: 'X' })).toHaveAttribute(
      'href',
      'https://x.com/digitalogaa'
    );
    expect(
      screen.getByRole('link', { name: /Best Phones in Nigeria/ })
    ).toHaveAttribute('href', '/blog/best-phones');

    const scripts = container.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    const profileScript = Array.from(scripts).find((s) =>
      s.textContent?.includes('ProfilePage')
    );
    expect(profileScript?.textContent).toContain(
      '"@id":"https://ogabassey.com#author-bassey-john"'
    );
    expect(profileScript?.textContent).toContain(
      '"jobTitle":"Performance Marketing Specialist"'
    );
  });

  it('calls notFound for an unknown author slug before querying posts', async () => {
    mockGetBlogAuthorBySlug.mockReturnValue(null);

    await expect(
      BlogAuthorPageContent({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          authorSlug: 'nobody',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockGetCachedBlogAuthor).not.toHaveBeenCalled();
  });

  it('calls notFound when the author has no published posts', async () => {
    mockGetCachedBlogAuthor.mockResolvedValue(null);

    await expect(
      BlogAuthorPageContent({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          authorSlug: 'bassey-john',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { BlogAuthorPageContent } from './blog-author-page-content';

const authorData = {
  merchant: {
    id: 'm1',
    business_name: 'Ogabassey',
    slug: 'ogabassey',
    logo_url: '',
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
      author_name: 'Bassey John',
      author_title: 'Performance Marketing Specialist',
      author_bio: 'Bassey John writes practical device buying guides.',
      author_image_url: 'https://cdn.ogabassey.com/authors/bassey-john.jpg',
      published_at: '2026-03-16T10:00:00.000Z',
      reading_time_minutes: 4,
    },
  ],
  totalPosts: 1,
  currentPage: 1,
  totalPages: 1,
};

function renderAuthorContent(
  data: typeof authorData = authorData,
  sameAs: string[] = []
) {
  return BlogAuthorPageContent({
    data,
    normalizedAuthorSlug: 'bassey-john',
    sameAs,
  });
}

describe('BlogAuthorPageContent navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders crawlable pagination and a full-count ItemList for multi-page authors', async () => {
    const { container } = render(
      await renderAuthorContent({
        ...authorData,
        totalPosts: 30,
        currentPage: 2,
        totalPages: 3,
      })
    );

    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      './bassey-john'
    );
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      './bassey-john?page=3'
    );
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    const itemListScript = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).find((s) => s.textContent?.includes('ItemList'));
    expect(itemListScript?.textContent).toContain('"numberOfItems":30');
    expect(itemListScript?.textContent).toContain('"position":13');
  });

  it('keeps author navigation origin-preserving without relying on merchant headers', async () => {
    render(await renderAuthorContent());

    expect(screen.getByRole('link', { name: /Back to Blog/ })).toHaveAttribute(
      'href',
      '..'
    );
    expect(
      screen.getByRole('link', { name: /Best Phones in Nigeria/ })
    ).toHaveAttribute('href', '../best-phones');

    expect(
      new URL('..', 'https://ogabassey.com/blog/author/bassey-john').href
    ).toBe('https://ogabassey.com/blog/');
    expect(
      new URL(
        '..',
        'https://preview.usebaci.com/ogabassey/blog/author/bassey-john'
      ).href
    ).toBe('https://preview.usebaci.com/ogabassey/blog/');
    expect(
      new URL('../best-phones', 'https://ogabassey.com/blog/author/bassey-john')
        .href
    ).toBe('https://ogabassey.com/blog/best-phones');
    expect(
      new URL(
        '../best-phones',
        'https://preview.usebaci.com/ogabassey/blog/author/bassey-john'
      ).href
    ).toBe('https://preview.usebaci.com/ogabassey/blog/best-phones');
  });
});

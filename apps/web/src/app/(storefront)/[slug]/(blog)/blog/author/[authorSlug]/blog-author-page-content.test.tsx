import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHeaders } = vi.hoisted(() => ({
  mockHeaders: vi.fn(() => {
    throw new Error('author page must not read request headers');
  }),
}));

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
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
  overrides: Partial<Parameters<typeof BlogAuthorPageContent>[0]> = {}
) {
  return BlogAuthorPageContent({
    data: authorData,
    normalizedAuthorSlug: 'bassey-john',
    sameAs: [
      'https://www.linkedin.com/in/bassey-john-6a277885',
      'https://twitter.com/digitalogaa',
    ],
    ...overrides,
  });
}

describe('BlogAuthorPageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockImplementation(() => {
      throw new Error('author page must not read request headers');
    });
  });

  it('renders the author profile, social links, posts, and a ProfilePage/Person graph', async () => {
    const { container } = render(await renderAuthorContent());

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
      'https://twitter.com/digitalogaa'
    );
    expect(
      screen.getByRole('link', { name: /Best Phones in Nigeria/ })
    ).toHaveAttribute('href', '../best-phones');

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

  it('normalizes mixed-case author slugs for canonical Person ids', async () => {
    const { container } = render(
      await renderAuthorContent({ normalizedAuthorSlug: 'bassey-john' })
    );

    const profileScript = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]')
    ).find((s) => s.textContent?.includes('ProfilePage'));
    expect(profileScript?.textContent).toContain(
      '"@id":"https://ogabassey.com#author-bassey-john"'
    );
    expect(profileScript?.textContent).toContain(
      '"url":"https://ogabassey.com/blog/author/bassey-john"'
    );
  });

  it('uses origin-preserving relative navigation without request headers', async () => {
    render(await renderAuthorContent());

    expect(screen.getByRole('link', { name: /Back to Blog/ })).toHaveAttribute(
      'href',
      '..'
    );
    expect(mockHeaders).not.toHaveBeenCalled();
  });
});

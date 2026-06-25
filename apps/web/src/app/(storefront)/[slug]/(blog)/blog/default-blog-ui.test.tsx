import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DefaultBlogUi } from './default-blog-ui';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/storefront/ogabassey/components/AdUnit', () => ({
  AdUnit: ({ placementKey }: { placementKey: string }) => (
    <div>{placementKey}</div>
  ),
}));

vi.mock('./blog-list', () => ({
  BlogList: ({ totalPosts }: { totalPosts: number }) => (
    <div>BlogList:{totalPosts}</div>
  ),
}));

describe('DefaultBlogUi', () => {
  it('renders the default blog chrome, filters, and content list', () => {
    render(
      <DefaultBlogUi
        blogSchema={{ '@type': 'Blog' }}
        breadcrumbSchema={{ '@type': 'BreadcrumbList' }}
        basePath="/ogabassey"
        categories={['News', 'Reviews']}
        category="News"
        merchant={{
          id: 'merchant-1',
          business_name: 'Ogabassey',
        }}
        posts={[
          {
            id: 'post-1',
            title: 'First Post',
            slug: 'first-post',
            excerpt: 'Excerpt',
            featured_image_url: null,
            featured_image_alt: null,
            category: 'News',
            tags: null,
            author_name: 'Oga',
            published_at: '2026-03-29T00:00:00.000Z',
            reading_time_minutes: 4,
            view_count: 10,
          },
        ]}
        searchQuery="pixel"
        slug="ogabassey"
        totalPosts={12}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Search results for "pixel"' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear search' })).toHaveAttribute(
      'href',
      '/ogabassey/blog'
    );
    expect(screen.getByRole('link', { name: 'RSS Feed' })).toHaveAttribute(
      'href',
      '/api/blog/feed/ogabassey'
    );
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute(
      'href',
      '/ogabassey/blog'
    );
    expect(screen.getByRole('link', { name: 'News' })).toHaveAttribute(
      'href',
      '/ogabassey/blog/category/news'
    );
    expect(screen.getByText('BLOG_SIDEBAR')).toBeInTheDocument();
    expect(screen.getByText('BlogList:12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bassey John' })).toHaveAttribute(
      'href',
      '/ogabassey/blog/author/bassey-john'
    );
    expect(screen.getByRole('link', { name: 'Bolakale' })).toHaveAttribute(
      'href',
      '/ogabassey/blog/author/bolakale'
    );
  });

  it('renders category hub copy when a category filter is active', () => {
    render(
      <DefaultBlogUi
        blogSchema={{ '@type': 'Blog' }}
        breadcrumbSchema={{ '@type': 'BreadcrumbList' }}
        basePath="/ogabassey"
        categories={['Smartphones']}
        category="Smartphones"
        merchant={{
          id: 'merchant-1',
          business_name: 'Ogabassey',
        }}
        posts={[]}
        slug="ogabassey"
        totalPosts={0}
      />
    );

    expect(
      screen.getByRole('heading', {
        name: 'Smartphones Articles',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Read articles, buying guides, comparisons, and shopping updates about smartphones from Ogabassey.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Smartphones' })).toHaveAttribute(
      'href',
      '/ogabassey/blog/category/smartphones'
    );
  });

  it('renders the Organization entity when an organizationSchema is provided', () => {
    const { container } = render(
      <DefaultBlogUi
        blogSchema={{ '@type': 'Blog' }}
        breadcrumbSchema={{ '@type': 'BreadcrumbList' }}
        organizationSchema={{ '@type': 'OnlineStore', name: 'Ogabassey' }}
        basePath="/ogabassey"
        categories={['News']}
        merchant={{ id: 'merchant-1', business_name: 'Ogabassey' }}
        posts={[]}
        slug="ogabassey"
        totalPosts={0}
      />
    );

    const scripts = container.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    const hasOrganization = Array.from(scripts).some((script) =>
      script.textContent?.includes('OnlineStore')
    );
    expect(hasOrganization).toBe(true);
  });
});

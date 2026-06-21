import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildListingResult,
  clusterCollections,
  type MockDefaultBlogUiProps,
  merchant,
  mockBuildBlogClusterCollections,
  mockDefaultBlogUi,
  mockGetCachedBlogListing,
  mockHeaders,
  mockNotFound,
  mockRedirect,
  postsPayload,
  resetBlogPageContentMocks,
} from './blog-page-content.test-utils';

const { default: BlogPage } = await import('./page');
const { BlogPageContent } = await import('./blog-page-content');

describe('BlogPageContent', () => {
  beforeEach(() => {
    resetBlogPageContentMocks();
  });

  it('throws not found when the listing data is missing at render time', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(null);

    await expect(
      BlogPageContent({
        params: Promise.resolve({ slug: 'missing-store' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalledOnce();
  });

  it('renders crawlable blog links in the route HTML instead of a Suspense shell', async () => {
    mockDefaultBlogUi.mockImplementation((props: MockDefaultBlogUiProps) => (
      <section>
        <h1>{props.merchant.business_name} blog</h1>
        {props.posts.map((post) => (
          <a key={post.slug} href={`/blog/${post.slug}`}>
            {post.title}
          </a>
        ))}
      </section>
    ));

    render(
      await BlogPage({
        params: Promise.resolve({ slug: 'test-store' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.queryByRole('status', { name: /loading blog posts/i })
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'First Post' })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: expect.stringContaining('/blog/first-post'),
        }),
      ])
    );
  });

  it('renders guide collections after the blog listing', async () => {
    mockBuildBlogClusterCollections.mockReturnValue(clusterCollections);

    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'ogabassey' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('heading', { name: /guide collections/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Best Phones in Nigeria' })
    ).toHaveAttribute(
      'href',
      'https://ogabassey.com/blog/best-phones-in-nigeria'
    );
    const blogListing = screen.getByText('Ogabassey blog');
    const guideCollections = screen.getByRole('heading', {
      name: /guide collections/i,
    });
    const discoveryLinks = screen.getByRole('heading', {
      name: /continue exploring/i,
    });
    expect(
      blogListing.compareDocumentPosition(guideCollections) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      guideCollections.compareDocumentPosition(discoveryLinks) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('redirects out-of-range paginated listings to the last real page', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(
      buildListingResult({
        merchant: {
          ...merchant,
          slug: 'ogabassey',
        },
        totalPosts: 50,
        posts: [],
      })
    );

    await expect(
      BlogPageContent({
        params: Promise.resolve({ slug: 'ogabassey' }),
        searchParams: Promise.resolve({ page: '999', category: 'Guides' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/ogabassey/blog?category=Guides&page=5');

    expect(mockRedirect).toHaveBeenCalledWith(
      '/ogabassey/blog?category=Guides&page=5'
    );
  });

  it('renders real prev/next head links for paginated listings', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(
      buildListingResult({
        merchant: {
          ...merchant,
          custom_domain: 'example.com',
        },
        totalPosts: 50,
      })
    );

    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'example.com' }),
        searchParams: Promise.resolve({ page: '2', category: 'Guides' }),
      })
    );

    expect(document.head.querySelector('link[rel="prev"]')).toHaveAttribute(
      'href',
      'https://example.com/blog?category=Guides'
    );
    expect(document.head.querySelector('link[rel="next"]')).toHaveAttribute(
      'href',
      'https://example.com/blog?category=Guides&page=3'
    );
  });

  it('uses domain-relative pagination links on storefront subdomains', async () => {
    mockHeaders.mockReturnValue(
      new Headers([['x-merchant-slug', 'ogabassey']])
    );
    mockGetCachedBlogListing.mockResolvedValueOnce(
      buildListingResult({
        merchant: {
          ...merchant,
          slug: 'ogabassey',
        },
        totalPosts: 50,
      })
    );

    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'ogabassey' }),
        searchParams: Promise.resolve({ page: '2' }),
      })
    );

    expect(screen.getByTestId('blog-pagination')).toHaveAttribute(
      'data-store-base-path',
      ''
    );
    expect(mockDefaultBlogUi).toHaveBeenCalledWith(
      expect.objectContaining({
        basePath: '',
      })
    );
  });

  it('preserves path-prefixed storefront origins in prev/next head links', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(
      buildListingResult({
        merchant: {
          ...merchant,
          store_url: 'http://localhost:3000/ogabassey',
        },
        totalPosts: 50,
      })
    );

    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'ogabassey' }),
        searchParams: Promise.resolve({ page: '2' }),
      })
    );

    expect(document.head.querySelector('link[rel="prev"]')).toHaveAttribute(
      'href',
      'http://localhost:3000/ogabassey/blog'
    );
    expect(document.head.querySelector('link[rel="next"]')).toHaveAttribute(
      'href',
      'http://localhost:3000/ogabassey/blog?page=3'
    );
  });

  it('uses structured image variants and preserves listing pagination totals', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(
      buildListingResult({
        totalPosts: 50,
      })
    );

    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'ogabassey' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(mockDefaultBlogUi).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: ['News'],
        posts: [postsPayload[0]],
        totalPosts: 50,
      })
    );
    expect(mockDefaultBlogUi.mock.calls[0]?.[0].blogSchema.blogPost).toEqual([
      expect.objectContaining({
        image: [
          'https://cdn.example.com/blog-cover-16x9.png',
          'https://cdn.example.com/blog-cover-4x3.png',
          'https://cdn.example.com/blog-cover-1x1.png',
        ],
      }),
    ]);
    expect(mockDefaultBlogUi.mock.calls[0]?.[0].blogSchema.publisher).toEqual(
      expect.objectContaining({
        '@id': 'https://test-store.usebaci.com#organization',
      })
    );
  });
});

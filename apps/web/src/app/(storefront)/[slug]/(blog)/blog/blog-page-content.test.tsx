import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildListingResult,
  clusterCollections,
  type MockDefaultBlogUiProps,
  mockBuildBlogClusterCollections,
  mockDefaultBlogUi,
  mockGetCachedBlogListing,
  mockNotFound,
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
  });
});

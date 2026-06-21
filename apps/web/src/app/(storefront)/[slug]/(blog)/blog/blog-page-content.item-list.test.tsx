import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';
import {
  buildListingResult,
  mockDefaultBlogUi,
  mockGetCachedBlogListing,
  postsPayload,
  resetBlogPageContentMocks,
} from './blog-page-content.test-utils';

const { BlogPageContent } = await import('./blog-page-content');

describe('BlogPageContent ItemList schema', () => {
  beforeEach(() => {
    resetBlogPageContentMocks();
  });

  it('passes an ItemList schema for crawlable blog listing entities', async () => {
    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'test-store' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(mockDefaultBlogUi).toHaveBeenCalledWith(
      expect.objectContaining({
        itemListSchema: expect.objectContaining({
          '@type': 'ItemList',
          name: 'Ogabassey Blog articles',
          numberOfItems: 1,
          url: 'https://test-store.usebaci.com/blog',
          itemListElement: [
            expect.objectContaining({
              '@type': 'ListItem',
              position: 1,
              url: 'https://test-store.usebaci.com/blog/first-post',
              name: 'First Post',
            }),
          ],
        }),
      })
    );
  });

  it('omits ItemList schema when the blog listing has no posts', async () => {
    mockGetCachedBlogListing.mockResolvedValueOnce(
      buildListingResult({
        posts: [],
        totalPosts: 0,
      })
    );

    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'test-store' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(mockDefaultBlogUi).toHaveBeenCalledWith(
      expect.objectContaining({
        itemListSchema: undefined,
      })
    );
  });

  it('matches ItemList URL and positions to filtered paginated listing URLs', async () => {
    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'test-store' }),
        searchParams: Promise.resolve({
          category: 'News',
          page: '2',
          search: 'phone launch',
        }),
      })
    );

    const itemListSchema = mockDefaultBlogUi.mock.calls[0]?.[0].itemListSchema;

    expect(itemListSchema).toEqual(
      expect.objectContaining({
        url: 'https://test-store.usebaci.com/blog?category=News&search=phone+launch&page=2',
        itemListElement: [
          expect.objectContaining({
            position: BLOG_LISTING_PAGE_SIZE + 1,
            url: 'https://test-store.usebaci.com/blog/first-post',
          }),
        ],
      })
    );
  });

  it('keeps ItemList count aligned with the emitted top-ten entries', async () => {
    const posts = Array.from({ length: 15 }, (_, index) => ({
      ...postsPayload[0],
      id: `post-${index + 1}`,
      title: `Post ${index + 1}`,
      slug: `post-${index + 1}`,
    }));

    mockGetCachedBlogListing.mockResolvedValueOnce(
      buildListingResult({
        posts,
        totalPosts: posts.length,
      })
    );

    render(
      await BlogPageContent({
        params: Promise.resolve({ slug: 'test-store' }),
        searchParams: Promise.resolve({}),
      })
    );

    const itemListSchema = mockDefaultBlogUi.mock.calls[0]?.[0].itemListSchema;

    expect(itemListSchema).toEqual(
      expect.objectContaining({
        numberOfItems: 10,
        itemListElement: expect.arrayContaining([
          expect.objectContaining({
            position: 1,
            name: 'Post 1',
          }),
          expect.objectContaining({
            position: 10,
            name: 'Post 10',
          }),
        ]),
      })
    );
    expect(itemListSchema?.itemListElement).toHaveLength(10);
  });
});

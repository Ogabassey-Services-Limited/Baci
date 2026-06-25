import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildListingResult,
  merchant,
  mockDefaultBlogUi,
  mockGetCachedBlogListing,
  mockNotFound,
  resetBlogPageContentMocks,
} from '../../blog-page-content.test-utils';

const { default: BlogCategoryPage, generateMetadata } = await import('./page');

describe('blog category page', () => {
  beforeEach(() => {
    resetBlogPageContentMocks();
    mockGetCachedBlogListing.mockResolvedValue({
      ...buildListingResult({
        merchant: {
          ...merchant,
          custom_domain: 'ogabassey.com',
        },
      }),
      categories: ['Smartphones', 'Laptops'],
    });
  });

  it('renders a clean category hub with the resolved public category label', async () => {
    render(
      await BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          categorySlug: 'smartphones',
        }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(screen.getByText('Ogabassey blog')).toBeInTheDocument();
    expect(mockGetCachedBlogListing).toHaveBeenNthCalledWith(
      1,
      'ogabassey.com',
      { page: 1 }
    );
    expect(mockDefaultBlogUi).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Smartphones',
      })
    );
  });

  it('returns notFound for unknown category slugs', async () => {
    await expect(
      BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          categorySlug: 'tablets',
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalledOnce();
    expect(mockDefaultBlogUi).not.toHaveBeenCalled();
  });

  it('uses indexable metadata with the clean category canonical', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        categorySlug: 'smartphones',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe(
      'Smartphones Buying Guides and Comparisons | Ogabassey'
    );
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/category/smartphones'
    );
  });

  it('keeps searched category hubs noindex with search-scoped canonical data', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        categorySlug: 'smartphones',
      }),
      searchParams: Promise.resolve({ search: 'iphone' }),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog?category=Smartphones&search=iphone'
    );
  });

  it('keeps paginated category hubs noindex with page-scoped canonical data', async () => {
    mockGetCachedBlogListing.mockResolvedValue({
      ...buildListingResult({
        merchant: {
          ...merchant,
          custom_domain: 'ogabassey.com',
        },
        totalPosts: 50,
      }),
      categories: ['Smartphones', 'Laptops'],
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        categorySlug: 'smartphones',
      }),
      searchParams: Promise.resolve({ page: '2' }),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog?category=Smartphones&page=2'
    );
  });

  it('returns noindex metadata for unknown category slugs', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        categorySlug: 'tablets',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata).toEqual({
      title: 'Blog Category Not Found',
      robots: { index: false, follow: false },
    });
  });
});

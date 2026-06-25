import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildListingResult,
  merchant,
  mockGetCachedBlogListing,
  mockNotFound,
  mockResolveBlogCategoryHub,
  resetBlogPageContentMocks,
} from '../../blog-page-content.test-utils';

interface MockBlogPageContentProps {
  itemListSchemaUrl?: string;
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    category: string;
    page?: string;
    search?: string;
  }>;
}

const mockBlogPageContent = vi.hoisted(() =>
  vi.fn((_props: MockBlogPageContentProps) => <div>Ogabassey blog</div>)
);

vi.mock('../../blog-page-content', () => ({
  BlogPageContent: (props: unknown) =>
    mockBlogPageContent(props as MockBlogPageContentProps),
}));

const { default: BlogCategoryPage, generateMetadata } = await import('./page');

describe('blog category page', () => {
  beforeEach(() => {
    resetBlogPageContentMocks();
    mockBlogPageContent.mockReset();
    mockBlogPageContent.mockReturnValue(<div>Ogabassey blog</div>);
    mockResolveBlogCategoryHub.mockResolvedValue({
      canonicalUrl: 'https://ogabassey.com/blog/category/smartphones',
      categoryLabel: 'Smartphones',
    });
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
    expect(mockResolveBlogCategoryHub).toHaveBeenCalledWith(
      'ogabassey.com',
      'smartphones'
    );
    expect(mockBlogPageContent).toHaveBeenCalledWith(
      expect.objectContaining({
        itemListSchemaUrl: 'https://ogabassey.com/blog/category/smartphones',
        params: expect.any(Promise),
        searchParams: expect.any(Promise),
      })
    );
    await expect(
      mockBlogPageContent.mock.calls[0]?.[0].searchParams
    ).resolves.toEqual({
      category: 'Smartphones',
      page: undefined,
      search: undefined,
    });
  });

  it('returns notFound for unknown category slugs', async () => {
    mockResolveBlogCategoryHub.mockResolvedValueOnce(null);

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
    expect(mockBlogPageContent).not.toHaveBeenCalled();
  });

  it('uses indexable metadata with the clean category canonical', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        categorySlug: 'smartphones',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe('Smartphones Articles | Ogabassey');
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/category/smartphones'
    );
  });

  it('keeps searched category hubs noindex with search-scoped canonical data', async () => {
    render(
      await BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          categorySlug: 'smartphones',
        }),
        searchParams: Promise.resolve({ search: 'iphone' }),
      })
    );

    expect(mockBlogPageContent).toHaveBeenCalledWith(
      expect.objectContaining({
        itemListSchemaUrl: undefined,
      })
    );

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
    mockResolveBlogCategoryHub.mockResolvedValueOnce(null);

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

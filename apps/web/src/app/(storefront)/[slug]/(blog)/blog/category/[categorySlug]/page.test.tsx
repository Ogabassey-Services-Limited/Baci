import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildListingResult,
  merchant,
  mockGetCachedBlogListing,
  mockNotFound,
  mockRedirect,
  mockResolveBlogCategoryHub,
  resetBlogPageContentMocks,
} from '../../blog-page-content.test-utils';

interface MockBlogPageContentProps {
  categoryOverride?: string;
  isCleanCategoryRoute?: boolean;
  itemListSchemaUrl?: string;
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    category?: string;
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

const {
  default: BlogCategoryPage,
  generateMetadata,
  generateStaticParams,
} = await import('./page');

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

    expect(await screen.findByText('Ogabassey blog')).toBeInTheDocument();
    expect(mockResolveBlogCategoryHub).toHaveBeenCalledWith(
      'ogabassey.com',
      'smartphones'
    );
    expect(mockBlogPageContent).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryOverride: 'Smartphones',
        isCleanCategoryRoute: true,
        itemListSchemaUrl: 'https://ogabassey.com/blog/category/smartphones',
        params: expect.any(Promise),
        searchParams: expect.any(Promise),
      })
    );
    await expect(
      mockBlogPageContent.mock.calls[0]?.[0].searchParams
    ).resolves.toEqual({});
  });

  it('does not resolve non-static category search params before the Suspense content boundary renders', async () => {
    const searchParams = new Promise<{ page?: string; search?: string }>(() => {
      // Intentionally unresolved; this route shell must pass it through
      // without subscribing to it outside the Suspense boundary.
    });
    const thenSpy = vi.spyOn(searchParams, 'then');

    await BlogCategoryPage({
      params: Promise.resolve({
        slug: 'test-store',
        categorySlug: 'smartphones',
      }),
      searchParams,
    });
    await Promise.resolve();

    expect(thenSpy).not.toHaveBeenCalled();
    expect(mockBlogPageContent).not.toHaveBeenCalled();
  });

  it('does not wrap static OgaBassey category hubs in Suspense', async () => {
    const searchParams = new Promise<{ page?: string; search?: string }>(() => {
      // Intentionally unresolved; static category hubs should pass this through
      // to BlogPageContent without Suspense subscribing at the route shell.
    });
    const thenSpy = vi.spyOn(searchParams, 'then');

    render(
      await BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          categorySlug: 'smartphones',
        }),
        searchParams,
      })
    );

    expect(thenSpy).not.toHaveBeenCalled();
    expect(await screen.findByText('Ogabassey blog')).toBeInTheDocument();
  });

  it('shows the category fallback while non-static clean category content is resolving', async () => {
    mockBlogPageContent.mockImplementation(() => {
      throw new Promise(() => {
        // Intentionally never resolves so Suspense fallback remains visible.
      });
    });

    render(
      await BlogCategoryPage({
        params: Promise.resolve({
          slug: 'test-store',
          categorySlug: 'smartphones',
        }),
        searchParams: Promise.resolve({ page: '99' }),
      })
    );

    expect(
      screen.getByRole('status', { name: 'Loading blog posts' })
    ).toBeInTheDocument();
    expect(mockGetCachedBlogListing).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('generates static params for public OgaBassey category hubs', async () => {
    const params = await generateStaticParams();

    expect(params).toContainEqual({
      slug: 'ogabassey.com',
      categorySlug: 'laptops',
    });
    expect(params).toContainEqual({
      slug: 'ogabassey.com',
      categorySlug: 'smartphones',
    });
  });

  it('falls back to default OgaBassey category hubs when category discovery fails', async () => {
    mockGetCachedBlogListing.mockRejectedValueOnce(
      new Error('category discovery failed')
    );

    const params = await generateStaticParams();

    expect(params).toContainEqual({
      slug: 'ogabassey.com',
      categorySlug: 'laptops',
    });
    expect(params).toContainEqual({
      slug: 'ogabassey.com',
      categorySlug: 'smartphones',
    });
  });

  it('calls notFound before rendering the shell when the category hub cannot be resolved', async () => {
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

    expect(mockNotFound).toHaveBeenCalledTimes(1);
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

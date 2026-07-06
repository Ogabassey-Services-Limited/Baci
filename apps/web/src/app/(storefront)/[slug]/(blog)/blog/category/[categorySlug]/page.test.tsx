import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildListingResult,
  merchant,
  mockGetCachedBlogListing,
  mockHeaders,
  mockNotFound,
  mockPermanentRedirect,
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
    mockHeaders.mockReset();
    mockHeaders.mockReturnValue(new Headers());
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

  it('never subscribes to request category search params when building the static shell', async () => {
    const searchParams = new Promise<{ page?: string; search?: string }>(() => {
      // Intentionally unresolved; the canonical category shell must not read
      // request searchParams at all (it renders canonical page 1).
    });
    const thenSpy = vi.spyOn(searchParams, 'then');

    await BlogCategoryPage({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        categorySlug: 'smartphones',
      }),
      searchParams,
    });
    await Promise.resolve();

    expect(thenSpy).not.toHaveBeenCalled();
    expect(mockBlogPageContent).not.toHaveBeenCalled();
  });

  it('does not resolve non-static category search params before the Suspense content boundary renders', async () => {
    const searchParams = new Promise<{ page?: string; search?: string }>(() => {
      // Intentionally unresolved; this route shell must pass it through
      // without subscribing to it outside the Suspense boundary.
    });
    const thenSpy = vi.spyOn(searchParams, 'then');

    await BlogCategoryPage({
      params: Promise.resolve({
        slug: 'dynamic-store',
        categorySlug: 'smartphones',
      }),
      searchParams,
    });
    await Promise.resolve();

    expect(thenSpy).not.toHaveBeenCalled();
    expect(mockBlogPageContent).not.toHaveBeenCalled();
  });

  it('shows the category fallback while static OgaBassey category content is resolving', async () => {
    mockBlogPageContent.mockImplementation(() => {
      throw new Promise(() => {
        // Intentionally never resolves so Suspense fallback remains visible.
      });
    });

    render(
      await BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
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

  it('shows the category fallback while non-static clean category content is resolving', async () => {
    mockBlogPageContent.mockImplementation(() => {
      throw new Promise(() => {
        // Intentionally never resolves so Suspense fallback remains visible.
      });
    });

    render(
      await BlogCategoryPage({
        params: Promise.resolve({
          slug: 'dynamic-store',
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

  it('forwards request search params to non-static category content so pagination/search work', async () => {
    const requestSearchParams = Promise.resolve({ page: '2' });

    render(
      await BlogCategoryPage({
        params: Promise.resolve({
          slug: 'dynamic-store',
          categorySlug: 'smartphones',
        }),
        searchParams: requestSearchParams,
      })
    );

    expect(mockBlogPageContent).toHaveBeenCalledWith(
      expect.objectContaining({ searchParams: requestSearchParams })
    );
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

  it('permanently redirects duplicate review category aliases to the canonical reviews archive', async () => {
    mockResolveBlogCategoryHub
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        canonicalUrl: 'https://ogabassey.com/blog/category/reviews',
        categoryLabel: 'Reviews',
      });

    await expect(
      BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          categorySlug: 'review',
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_PERMANENT_REDIRECT:/blog/category/reviews');

    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      '/blog/category/reviews'
    );
    expect(mockResolveBlogCategoryHub).toHaveBeenNthCalledWith(
      1,
      'ogabassey.com',
      'review'
    );
    expect(mockResolveBlogCategoryHub).toHaveBeenNthCalledWith(
      2,
      'ogabassey.com',
      'reviews'
    );
    expect(mockBlogPageContent).not.toHaveBeenCalled();
  });

  it('preserves query params when redirecting duplicate category aliases', async () => {
    mockResolveBlogCategoryHub
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        canonicalUrl: 'https://ogabassey.com/blog/category/reviews',
        categoryLabel: 'Reviews',
      });

    await expect(
      BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          categorySlug: 'review',
        }),
        searchParams: Promise.resolve({ page: '2', search: 'iphone' }),
      })
    ).rejects.toThrow(
      'NEXT_PERMANENT_REDIRECT:/blog/category/reviews?page=2&search=iphone'
    );

    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      '/blog/category/reviews?page=2&search=iphone'
    );
  });

  it('redirects mixed-case clean category requests to the canonical lowercase route', async () => {
    mockResolveBlogCategoryHub.mockResolvedValueOnce({
      canonicalUrl: 'https://ogabassey.com/blog/category/reviews',
      categoryLabel: 'Reviews',
    });

    await expect(
      BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          categorySlug: 'Reviews',
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow(
      'NEXT_PERMANENT_REDIRECT:/ogabassey/blog/category/reviews'
    );

    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      '/ogabassey/blog/category/reviews'
    );
  });

  it('prefixes duplicate review redirects for path-mode storefronts', async () => {
    mockResolveBlogCategoryHub
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        canonicalUrl: 'https://ogabassey.com/blog/category/reviews',
        categoryLabel: 'Reviews',
      });

    await expect(
      BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          categorySlug: 'review',
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow(
      'NEXT_PERMANENT_REDIRECT:/ogabassey/blog/category/reviews'
    );

    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      '/ogabassey/blog/category/reviews'
    );
  });

  it('keeps duplicate review redirects unprefixed for subdomain storefronts', async () => {
    mockHeaders.mockReturnValue(
      new Headers([
        ['host', 'ogabassey.usebaci.com'],
        ['x-merchant-slug', 'ogabassey'],
      ])
    );
    mockResolveBlogCategoryHub
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        canonicalUrl: 'https://ogabassey.com/blog/category/reviews',
        categoryLabel: 'Reviews',
      });

    await expect(
      BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          categorySlug: 'review',
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_PERMANENT_REDIRECT:/blog/category/reviews');

    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      '/blog/category/reviews'
    );
  });

  it('does not redirect a non-Ogabassey singular review category', async () => {
    mockResolveBlogCategoryHub.mockResolvedValueOnce({
      canonicalUrl: 'https://merchant.example/blog/category/review',
      categoryLabel: 'Review',
    });

    render(
      await BlogCategoryPage({
        params: Promise.resolve({
          slug: 'merchant-a',
          categorySlug: 'review',
        }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(mockPermanentRedirect).not.toHaveBeenCalled();
    expect(mockResolveBlogCategoryHub).toHaveBeenCalledWith(
      'merchant-a',
      'review'
    );
    expect(await screen.findByText('Ogabassey blog')).toBeInTheDocument();
  });

  it('does not fall back to Ogabassey aliases for unknown non-Ogabassey categories', async () => {
    mockResolveBlogCategoryHub.mockResolvedValueOnce(null);

    await expect(
      BlogCategoryPage({
        params: Promise.resolve({
          slug: 'merchant-a',
          categorySlug: 'review',
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockPermanentRedirect).not.toHaveBeenCalled();
    expect(mockResolveBlogCategoryHub).toHaveBeenCalledTimes(1);
    expect(mockResolveBlogCategoryHub).toHaveBeenCalledWith(
      'merchant-a',
      'review'
    );
  });

  it('calls notFound without resolving the hub for over-encoded bot category slugs', async () => {
    let overEncodedSlug = 'smartphones and tablets';
    for (let i = 0; i < 10; i++) {
      overEncodedSlug = encodeURIComponent(overEncodedSlug);
    }

    await expect(
      BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          categorySlug: overEncodedSlug,
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalledTimes(1);
    expect(mockResolveBlogCategoryHub).not.toHaveBeenCalled();
    expect(mockBlogPageContent).not.toHaveBeenCalled();
  });

  it('calls notFound without resolving the hub for extremely long category slugs', async () => {
    await expect(
      BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          categorySlug: 'a'.repeat(4000),
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalledTimes(1);
    expect(mockResolveBlogCategoryHub).not.toHaveBeenCalled();
  });

  it('returns not-found metadata without resolving the hub for over-encoded category slugs', async () => {
    let overEncodedSlug = 'smartphones and tablets';
    for (let i = 0; i < 10; i++) {
      overEncodedSlug = encodeURIComponent(overEncodedSlug);
    }

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        categorySlug: overEncodedSlug,
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe('Blog Category Not Found');
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(mockResolveBlogCategoryHub).not.toHaveBeenCalled();
  });

  it('uses indexable metadata with the clean category canonical', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        categorySlug: 'smartphones',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toEqual({
      absolute: 'Smartphones Articles | Ogabassey',
    });
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/category/smartphones'
    );
  });

  it('noindexes mixed-case clean category metadata while preserving the canonical URL', async () => {
    mockResolveBlogCategoryHub.mockResolvedValueOnce({
      canonicalUrl: 'https://ogabassey.com/blog/category/reviews',
      categoryLabel: 'Reviews',
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        categorySlug: 'Reviews',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/category/reviews'
    );
  });

  it('resolves duplicate review category alias metadata to the canonical reviews archive', async () => {
    mockResolveBlogCategoryHub
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        canonicalUrl: 'https://ogabassey.com/blog/category/reviews',
        categoryLabel: 'Reviews',
      });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        categorySlug: 'review',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(mockResolveBlogCategoryHub).toHaveBeenCalledWith(
      'ogabassey.com',
      'review'
    );
    expect(mockResolveBlogCategoryHub).toHaveBeenCalledWith(
      'ogabassey.com',
      'reviews'
    );
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/category/reviews'
    );
  });

  // Category metadata is now request-searchParams-free: paginated/search
  // variants canonicalize to the clean hub via this same indexable metadata
  // (the builder's own variant logic is covered in blog-listing-metadata.test).
  it('emits indexable clean-category metadata regardless of request query params', async () => {
    const thenSpy = vi.fn(() => {
      throw new Error('category metadata resolved request search params');
    });
    const requestSearchParams = Object.defineProperty({}, 'then', {
      value: thenSpy,
    }) as Promise<{ page?: string; search?: string }>;

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        categorySlug: 'smartphones',
      }),
      searchParams: requestSearchParams,
    });

    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/category/smartphones'
    );
    expect(thenSpy).not.toHaveBeenCalled();
  });

  it('reads ?page for non-static category metadata (noindex page variant)', async () => {
    mockGetCachedBlogListing.mockResolvedValue({
      ...buildListingResult({
        merchant: { ...merchant, custom_domain: 'ogabassey.com' },
        totalPosts: 50,
      }),
      categories: ['Smartphones', 'Laptops'],
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'another-store',
        categorySlug: 'smartphones',
      }),
      searchParams: Promise.resolve({ page: '2' }),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(mockGetCachedBlogListing).toHaveBeenCalledWith('another-store', {
      category: 'Smartphones',
      page: 2,
    });
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

import { render, screen, waitFor } from '@testing-library/react';
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
  isCleanCategoryRoute?: boolean;
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

  it('renders the blog loading boundary while category resolution is pending', () => {
    mockResolveBlogCategoryHub.mockImplementationOnce(
      () =>
        new Promise(() => {
          // Keep category resolution suspended to verify the local PPR shell.
        })
    );

    render(
      BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          categorySlug: 'smartphones',
        }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('status', { name: /loading blog posts/i })
    ).toBeInTheDocument();
  });

  it('calls notFound when the category hub cannot be resolved', async () => {
    mockResolveBlogCategoryHub.mockResolvedValueOnce(null);

    render(
      BlogCategoryPage({
        params: Promise.resolve({
          slug: 'ogabassey.com',
          categorySlug: 'tablets',
        }),
        searchParams: Promise.resolve({}),
      })
    );

    await waitFor(() => {
      expect(mockNotFound).toHaveBeenCalledTimes(1);
    });
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

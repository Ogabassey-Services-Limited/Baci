import { render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBlogPostPageContent, mockBuildStoreUrl } = vi.hoisted(() => ({
  mockBlogPostPageContent: vi.fn((_props: unknown) => (
    <div>Blog post page content</div>
  )),
  mockBuildStoreUrl: vi.fn(
    (merchant: { slug: string; custom_domain?: string | null }) =>
      merchant.custom_domain
        ? `https://${merchant.custom_domain}`
        : `https://${merchant.slug}.usebaci.com`
  ),
}));

const mockDraftMode = vi.fn();
const mockHeaders = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockGetCachedBlogPost = vi.fn();

vi.mock('next/headers', () => ({
  draftMode: () => mockDraftMode(),
  headers: () => mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogPost: (...args: unknown[]) => mockGetCachedBlogPost(...args),
}));

vi.mock('@/app/(storefront)/[slug]/storefront-dynamic-metadata-marker', () => ({
  StorefrontDynamicMetadataMarker: () => (
    <div aria-label="dynamic metadata marker" role="status" />
  ),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { slug: string; custom_domain?: string | null }) =>
    mockBuildStoreUrl(merchant),
}));

vi.mock('./blog-post-content', () => ({
  buildBlogUrl: (baseUrl: string, basePath: string, postSlug?: string) =>
    postSlug
      ? `${baseUrl}${basePath}/blog/${postSlug}`
      : `${baseUrl}${basePath}/blog`,
  buildCanonicalBlogPostUrl: (
    merchant: { slug: string; custom_domain?: string },
    postSlug: string
  ) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}/blog/${postSlug}`
      : `https://${merchant.slug}.usebaci.com/blog/${postSlug}`,
  getBlogPostTextPreview: () => 'Preview text',
}));

vi.mock('./blog-post-page-content', () => ({
  default: (props: unknown) => mockBlogPostPageContent(props),
}));

vi.mock('./BlogPostPageFallback', () => ({
  BlogPostPageFallback: () => <div>Blog post page fallback</div>,
}));

import BlogPostPage, { generateMetadata } from './page';

const liveBlogPost = {
  merchant: {
    id: 'merchant-1',
    business_name: 'Ogabassey',
    slug: 'ogabassey',
    logo_url: null,
    custom_domain: 'ogabassey.com',
  },
  post: {
    id: 'post-1',
    title: 'The Great 5K Stall',
    slug: 'apple-studio-display-review',
    content: '<p>Test</p>',
    excerpt: 'Test excerpt',
    featured_image_url: null,
    featured_image_alt: null,
    category: 'Reviews',
    tags: ['reviews'],
    author_name: 'Bolakale',
    author_title: null,
    author_bio: null,
    published_at: '2026-03-16T10:05:33.654Z',
    updated_at: '2026-03-16T10:05:33.654Z',
    seo_title: null,
    seo_description: null,
    keywords: ['studio display'],
    reading_time_minutes: 4,
    word_count: 800,
  },
  relatedPosts: [],
  relatedProducts: [],
};

describe('storefront blog post page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
    mockBlogPostPageContent.mockReset();
    mockBlogPostPageContent.mockImplementation(() => (
      <div>Blog post page content</div>
    ));
    mockBuildStoreUrl.mockImplementation(
      (merchant: { slug: string; custom_domain?: string | null }) =>
        merchant.custom_domain
          ? `https://${merchant.custom_domain}`
          : `https://${merchant.slug}.usebaci.com`
    );
  });

  it('only exports the route surface from the page module', async () => {
    const routeModule = await import('./page');

    expect(Object.keys(routeModule).sort()).toEqual([
      'default',
      'generateMetadata',
    ]);
  });

  it('renders only the local shell while request-time blog content is pending', () => {
    mockBlogPostPageContent.mockImplementation(() => {
      throw new Promise(() => {
        // Keep the blog post page content suspended behind its local shell.
      });
    });

    render(
      <Suspense fallback={<div>Route loader fallback</div>}>
        <BlogPostPage
          params={Promise.resolve({
            slug: 'ogabassey.com',
            postSlug: 'apple-studio-display-review',
          })}
        />
      </Suspense>
    );

    expect(screen.getByText('Blog post page fallback')).toBeInTheDocument();
    expect(screen.queryByText('Route loader fallback')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Blog post page content')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: /dynamic metadata marker/i })
    ).toBeInTheDocument();
  });

  it('adds a metadata marker beside request-time blog content', () => {
    render(
      <BlogPostPage
        params={Promise.resolve({
          slug: 'ogabassey.com',
          postSlug: 'apple-studio-display-review',
        })}
      />
    );

    const content = screen.getByText('Blog post page content');
    const marker = screen.getByRole('status', {
      name: /dynamic metadata marker/i,
    });

    expect(content).toBeInTheDocument();
    expect(marker).toBeInTheDocument();
    expect(
      content.compareDocumentPosition(marker) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('resolves public metadata without consulting draft request state', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: true });
    mockGetCachedBlogPost.mockResolvedValue(liveBlogPost);

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        postSlug: 'apple-studio-display-review',
      }),
    });

    expect(mockDraftMode).not.toHaveBeenCalled();
    expect(mockGetCachedBlogPost).toHaveBeenCalledWith(
      'ogabassey.com',
      'apple-studio-display-review',
      false
    );
    expect(metadata.title).toBe('The Great 5K Stall | Ogabassey');
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/apple-studio-display-review'
    );
  });

  it('uses the cached blog query when metadata is already available', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockGetCachedBlogPost.mockResolvedValue(liveBlogPost);

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        postSlug: 'apple-studio-display-review',
      }),
    });

    expect(mockGetCachedBlogPost).toHaveBeenCalledWith(
      'ogabassey.com',
      'apple-studio-display-review',
      false
    );
    expect(metadata.title).toBe('The Great 5K Stall | Ogabassey');
  });

  it('returns noindex fallback metadata when the public cache lookup throws', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mockGetCachedBlogPost.mockRejectedValue(new Error('Cache lookup failed'));

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        postSlug: 'apple-studio-display-review',
      }),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching cached public blog metadata',
      expect.objectContaining({
        slug: 'ogabassey.com',
        postSlug: 'apple-studio-display-review',
        error: expect.any(Error),
      })
    );
    consoleErrorSpy.mockRestore();
  });

  it('returns noindex fallback metadata when only draft content may exist', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: true });
    mockGetCachedBlogPost.mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        postSlug: 'draft-only-post',
      }),
    });

    expect(mockDraftMode).not.toHaveBeenCalled();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('uses canonical URL from buildCanonicalBlogPostUrl for custom domains', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockGetCachedBlogPost.mockResolvedValue({
      ...liveBlogPost,
      merchant: {
        ...liveBlogPost.merchant,
        custom_domain: 'ogabassey.com',
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        postSlug: 'apple-studio-display-review',
      }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/apple-studio-display-review'
    );
  });

  it('uses the explicit social image route for OpenGraph and Twitter metadata', async () => {
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockBuildStoreUrl.mockReturnValue('http://localhost:3000/ogabassey');
    mockGetCachedBlogPost.mockResolvedValue({
      ...liveBlogPost,
      merchant: {
        ...liveBlogPost.merchant,
        custom_domain: null,
        slug: 'ogabassey',
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        postSlug: 'apple-studio-display-review',
      }),
    });

    expect(metadata.openGraph?.images).toEqual([
      {
        alt: 'The Great 5K Stall — Ogabassey',
        height: 630,
        type: 'image/png',
        url: 'http://localhost:3000/ogabassey/blog/apple-studio-display-review/opengraph-image',
        width: 1200,
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      'http://localhost:3000/ogabassey/blog/apple-studio-display-review/opengraph-image',
    ]);
  });
});

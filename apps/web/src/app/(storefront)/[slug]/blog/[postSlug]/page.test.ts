import { beforeEach, describe, expect, it, vi } from 'vitest';

const draftModeMock = vi.fn();
const headersMock = vi.fn();
const getCachedBlogPostMock = vi.fn();

vi.mock('next/headers', () => ({
  draftMode: draftModeMock,
  headers: headersMock,
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogPost: getCachedBlogPostMock,
}));

describe('blog post metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    draftModeMock.mockResolvedValue({ isEnabled: false });
    headersMock.mockResolvedValue(new Headers([['host', 'ogabassey.com']]));
    getCachedBlogPostMock.mockResolvedValue(null);
  });

  it('builds canonical metadata for an existing blog post', async () => {
    getCachedBlogPostMock.mockResolvedValue({
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      post: {
        slug: 'iphone-xr-in-2025',
        title: 'iPhone XR in 2025',
        seo_title: 'iPhone XR in 2025 Review',
        seo_description: 'Should you still buy the iPhone XR in 2025?',
        excerpt: 'A quick look at the iPhone XR in 2025.',
        content: 'A quick look at the iPhone XR in 2025.',
        author_name: 'Oga Bassey',
        published_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
        tags: ['iphone'],
        keywords: ['iphone xr', 'iphone'],
        featured_image_url: 'https://cdn.ogabassey.com/blog/iphone-xr.jpg',
        featured_image_alt: 'iPhone XR',
      },
    });

    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        postSlug: 'iphone-xr-in-2025',
      }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/iphone-xr-in-2025'
    );
    expect(metadata.robots).toMatchObject({
      index: true,
      follow: true,
    });
  }, 15_000);

  it('self-canonicalizes missing posts on the current store host', async () => {
    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        postSlug: 'search.php',
      }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/search.php'
    );
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it('falls back to the merchant subdomain when the host header is missing', async () => {
    headersMock.mockResolvedValue(new Headers());
    getCachedBlogPostMock.mockResolvedValue({
      merchant: {
        business_name: 'Ogabassey',
        slug: 'ogabassey',
      },
      post: {
        slug: 'iphone-xr-in-2025',
        title: 'iPhone XR in 2025',
        seo_title: 'iPhone XR in 2025 Review',
        seo_description: 'Should you still buy the iPhone XR in 2025?',
        excerpt: 'A quick look at the iPhone XR in 2025.',
        content: 'A quick look at the iPhone XR in 2025.',
        author_name: 'Oga Bassey',
        published_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
        tags: ['iphone'],
        keywords: ['iphone xr', 'iphone'],
        featured_image_url: 'https://cdn.ogabassey.com/blog/iphone-xr.jpg',
        featured_image_alt: 'iPhone XR',
      },
    });

    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey',
        postSlug: 'iphone-xr-in-2025',
      }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.usebaci.com/blog/iphone-xr-in-2025'
    );
    expect(metadata.robots).toMatchObject({
      index: true,
      follow: true,
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const headersMock = vi.fn();
const getCachedBlogPostMock = vi.fn();

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedBlogPost: getCachedBlogPostMock,
}));

describe('legacy blog catch-all metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    headersMock.mockResolvedValue(new Headers([['host', 'ogabassey.com']]));
    getCachedBlogPostMock.mockResolvedValue(null);
  });

  it('self-canonicalizes invalid archive paths on the current host', async () => {
    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        catchAll: ['tag', 'iphone'],
      }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/tag/iphone'
    );
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it('canonicalizes true legacy post aliases to the published post URL', async () => {
    getCachedBlogPostMock.mockResolvedValue({
      merchant: {
        business_name: 'Ogabassey',
      },
      post: {
        slug: 'macbook-air-m1-in-2024-the-perfect-laptop-or-time-to-look-elsewhere',
        title: 'MacBook Air M1 in 2024',
      },
    });

    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        catchAll: [
          '2024',
          '10',
          '14',
          'macbook-air-m1-in-2024-the-perfect-laptop-or-time-to-look-elsewhere',
        ],
      }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/macbook-air-m1-in-2024-the-perfect-laptop-or-time-to-look-elsewhere'
    );
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it('falls back to a self-canonical archive URL when a legacy alias no longer resolves', async () => {
    const { generateMetadata } = await import('./page');

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'ogabassey.com',
        catchAll: ['2024', '10', '14', 'non-existent-post'],
      }),
    });

    expect(metadata.title).toBe('Page Not Found');
    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/blog/2024/10/14/non-existent-post'
    );
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });
});

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
    draftModeMock.mockResolvedValue({ isEnabled: false });
    headersMock.mockResolvedValue(new Headers([['host', 'ogabassey.com']]));
    getCachedBlogPostMock.mockResolvedValue(null);
  });

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
});

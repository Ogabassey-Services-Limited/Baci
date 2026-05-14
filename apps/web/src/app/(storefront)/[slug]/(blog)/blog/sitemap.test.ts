import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';

let mockHeaders = new Map<string, string>();

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeaders),
}));

const mockGetMerchantByIdentifier = vi.fn();
const mockGetCachedFeatureSettings =
  vi.fn<(merchantId: string) => Promise<{ blog_enabled: boolean }>>();
mockGetCachedFeatureSettings.mockImplementation(async () => ({
  blog_enabled: true,
}));

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
  getCachedFeatureSettings: (merchantId: string) =>
    mockGetCachedFeatureSettings(merchantId),
}));

interface BlogPostRow {
  slug: string;
  published_at: string;
  updated_at: string;
  featured_image_url: string | null;
}

interface BlogPostsResponse {
  data: BlogPostRow[] | null;
  error: Error | null;
}

interface EqChain {
  eq: (key: string, value: string) => EqChain | BlogPostsResponse;
  not: (
    key: string,
    operator: string,
    value: null
  ) => EqChain | BlogPostsResponse;
}

const mockEq =
  vi.fn<(key: string, value: string) => EqChain | BlogPostsResponse>();
const mockNot =
  vi.fn<(key: string, operator: string, value: null) => BlogPostsResponse>();
mockEq.mockImplementation(
  (): EqChain => ({
    eq: mockEq,
    not: mockNot,
  })
);
const mockSelect = vi.fn((): EqChain => ({ eq: mockEq, not: mockNot }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('blog sitemap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockHeaders = new Map();
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockGetCachedFeatureSettings.mockImplementation(async () => ({
      blog_enabled: true,
    }));
    mockNot.mockReset();
  });

  it('uses the merchant custom domain for blog sitemap entries', async () => {
    mockHeaders = new Map([['x-custom-domain', 'ogabassey.com']]);
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockEq.mockImplementation((...args: unknown[]) => {
      const [key, value] = args as [string, string];
      if (key === 'status' && value === 'published') {
        return { eq: mockEq, not: mockNot };
      }

      return { eq: mockEq, not: mockNot };
    });
    mockNot.mockImplementation((...args: unknown[]) => {
      const [key, operator, value] = args as [string, string, null];
      if (key === 'published_at' && operator === 'is' && value === null) {
        return {
          data: [
            {
              slug: 'factory-unlocked-iphones-explained',
              published_at: '2026-03-01T00:00:00Z',
              updated_at: '2026-03-02T00:00:00Z',
              featured_image_url: null,
            },
          ],
          error: null,
        };
      }

      return { data: [], error: null };
    });

    const { default: sitemap } = await import('./sitemap');

    const result = await sitemap();

    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.com');
    expect(result[0].url).toBe('https://ogabassey.com/blog');
    expect(result[1].url).toBe(
      'https://ogabassey.com/blog/factory-unlocked-iphones-explained'
    );
    expect(mockNot).toHaveBeenCalledWith('published_at', 'is', null);
  });

  it('falls back to the host header for custom domains when proxy headers are absent', async () => {
    mockHeaders = new Map([['host', 'ogabassey.com']]);
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockEq.mockImplementation((...args: unknown[]) => {
      const [key, value] = args as [string, string];
      if (key === 'status' && value === 'published') {
        return { eq: mockEq, not: mockNot };
      }

      return { eq: mockEq, not: mockNot };
    });
    mockNot.mockReturnValue({ data: [], error: null });

    const { default: sitemap } = await import('./sitemap');

    const result = await sitemap();

    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.com');
    expect(result[0].url).toBe('https://ogabassey.com/blog');
  });

  it('returns an empty sitemap when the merchant is not found', async () => {
    mockHeaders = new Map([['host', 'missing.example']]);
    mockGetMerchantByIdentifier.mockResolvedValue(null);

    const { default: sitemap } = await import('./sitemap');

    await expect(sitemap()).resolves.toEqual([]);
  });

  it('returns an empty sitemap when blog_enabled is false', async () => {
    mockHeaders = new Map([['host', 'ogabassey.com']]);
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockGetCachedFeatureSettings.mockResolvedValueOnce({
      blog_enabled: false,
    });

    const { default: sitemap } = await import('./sitemap');

    await expect(sitemap()).resolves.toEqual([]);
  });

  it('propagates blog post query errors', async () => {
    mockHeaders = new Map([['host', 'ogabassey.com']]);
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    mockEq.mockImplementation((...args: unknown[]) => {
      const [key, value] = args as [string, string];
      if (key === 'status' && value === 'published') {
        return { eq: mockEq, not: mockNot };
      }

      return { eq: mockEq, not: mockNot };
    });
    mockNot.mockReturnValue({ data: null, error: new Error('db') });

    const { default: sitemap } = await import('./sitemap');

    await expect(sitemap()).rejects.toThrow(
      'Failed to fetch blog posts for sitemap'
    );
  });
});

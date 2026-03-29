import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';

let mockHeaders = new Map<string, string>();

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeaders),
}));

const mockGetMerchantByIdentifier = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
}));

const mockEq: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>> = vi.fn(
  () => ({
    eq: mockEq,
  })
);
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe('blog sitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders = new Map();
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
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

      return { eq: mockEq };
    });

    const { default: sitemap } = await import('./sitemap');

    const result = await sitemap();

    expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.com');
    expect(result[0].url).toBe('https://ogabassey.com/blog');
    expect(result[1].url).toBe(
      'https://ogabassey.com/blog/factory-unlocked-iphones-explained'
    );
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
        return { data: [], error: null };
      }

      return { eq: mockEq };
    });

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
        return { data: null, error: new Error('db') };
      }

      return { eq: mockEq };
    });

    const { default: sitemap } = await import('./sitemap');

    await expect(sitemap()).rejects.toThrow('db');
  });
});

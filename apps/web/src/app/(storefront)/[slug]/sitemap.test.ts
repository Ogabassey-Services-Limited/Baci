import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Set env vars BEFORE any imports ----
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';

// ---- Mock state ----

// Track which headers the sitemap function reads
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

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: mockEq,
      }),
    }),
  })),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateSlug: vi.fn((str: string) => str.toLowerCase().replace(/\s+/g, '-')),
}));

// ---- Helper to set merchant slug via headers ----
function setSlugHeader(slug: string) {
  mockHeaders = new Map<string, string>([['x-merchant-slug', slug]]);
}

function setCustomDomainHeader(domain: string) {
  mockHeaders = new Map<string, string>([['x-custom-domain', domain]]);
}

// ---- Tests ----

describe('sitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders = new Map();
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
  });

  describe('generateSitemaps()', () => {
    it('returns three sitemap IDs (blog has its own at /blog/sitemap.xml)', async () => {
      const { generateSitemaps } = await import('./sitemap');

      const sitemaps = generateSitemaps();

      expect(sitemaps).toEqual([
        { id: 'static' },
        { id: 'products' },
        { id: 'categories' },
      ]);
    });
  });

  describe('merchant lookup', () => {
    it('looks up merchant by slug from x-merchant-slug header', async () => {
      setSlugHeader('ogabassey');
      const { default: sitemap } = await import('./sitemap');

      await sitemap({ id: Promise.resolve('static') });

      expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey');
    });

    it('uses the full custom domain identifier from x-custom-domain header', async () => {
      setCustomDomainHeader('ogabassey.com');
      mockGetMerchantByIdentifier.mockResolvedValue({
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      });
      const { default: sitemap } = await import('./sitemap');

      await sitemap({ id: Promise.resolve('static') });

      expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.com');
    });

    it('passes non-root custom domains through unchanged', async () => {
      setCustomDomainHeader('ogabassey.ng');
      const { default: sitemap } = await import('./sitemap');

      await sitemap({ id: Promise.resolve('static') });

      expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.ng');
    });

    it('returns empty array when merchant is not found', async () => {
      setSlugHeader('unknown');
      mockGetMerchantByIdentifier.mockResolvedValue(null);

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: Promise.resolve('static') });

      expect(result).toEqual([]);
    });
  });

  describe('storeUrl construction', () => {
    it('uses custom domain directly when header is a domain', async () => {
      setCustomDomainHeader('ogabassey.com');
      mockGetMerchantByIdentifier.mockResolvedValue({
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      });
      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: Promise.resolve('static') });

      expect(result[0].url).toBe('https://ogabassey.com');
    });

    it('builds subdomain URL when header is a plain slug', async () => {
      setSlugHeader('ogabassey');
      mockGetMerchantByIdentifier.mockResolvedValue({
        id: 'merchant-1',
        slug: 'ogabassey',
      });
      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: Promise.resolve('static') });

      expect(result[0].url).toBe('https://ogabassey.usebaci.com');
    });

    it('falls back to the raw host for custom domains when merchant headers are absent', async () => {
      mockHeaders = new Map([['host', 'ogabassey.com']]);
      mockGetMerchantByIdentifier.mockResolvedValue({
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      });
      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: Promise.resolve('static') });

      expect(mockGetMerchantByIdentifier).toHaveBeenCalledWith('ogabassey.com');
      expect(result[0].url).toBe('https://ogabassey.com');
    });
  });

  describe('static sitemap', () => {
    it('returns store URL and FAQ page', async () => {
      setCustomDomainHeader('ogabassey.com');
      mockGetMerchantByIdentifier.mockResolvedValue({
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      });
      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: Promise.resolve('static') });

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://ogabassey.com');
      expect(result[0].priority).toBe(1);
      expect(result[1].url).toBe('https://ogabassey.com/faq');
      expect(result[1].priority).toBe(0.5);
    });
  });

  describe('products sitemap', () => {
    it('generates URLs with category slug when available', async () => {
      setCustomDomainHeader('ogabassey.com');
      mockGetMerchantByIdentifier.mockResolvedValue({
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      });
      const productData = [
        {
          id: 'p1',
          slug: 'iphone-15',
          category: 'Smartphones',
          images: ['https://img.example.com/iphone.jpg'],
          updated_at: '2026-01-15T00:00:00Z',
          category_id: 'cat-1',
          categories: { slug: 'smartphones' },
        },
      ];
      mockEq.mockImplementation((...args: unknown[]) => {
        const [key, value] = args as [string, string];
        if (key === 'status' && value === 'active') {
          return { data: productData, error: null };
        }
        return { eq: mockEq };
      });

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: Promise.resolve('products') });

      expect(result[0].url).toBe('https://ogabassey.com/smartphones/iphone-15');
      expect(result[0].images).toEqual(['https://img.example.com/iphone.jpg']);
    });

    it('returns empty array when no products exist', async () => {
      setSlugHeader('ogabassey');
      mockEq.mockImplementation((...args: unknown[]) => {
        const [key, value] = args as [string, string];
        if (key === 'status' && value === 'active') {
          return { data: [], error: null };
        }
        return { eq: mockEq };
      });

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: Promise.resolve('products') });

      expect(result).toEqual([]);
    });

    it('throws when products cannot be loaded', async () => {
      setSlugHeader('ogabassey');
      mockEq.mockImplementation((...args: unknown[]) => {
        const [key, value] = args as [string, string];
        if (key === 'status' && value === 'active') {
          return { data: null, error: new Error('db') };
        }
        return { eq: mockEq };
      });

      const { default: sitemap } = await import('./sitemap');

      await expect(
        sitemap({ id: Promise.resolve('products') })
      ).rejects.toThrow('db');
    });
  });

  describe('unknown sitemap id', () => {
    it('returns empty array for unrecognized id', async () => {
      setSlugHeader('ogabassey');
      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: Promise.resolve('unknown') });

      expect(result).toEqual([]);
    });
  });

  describe('categories sitemap', () => {
    it('returns category sitemap entries', async () => {
      setSlugHeader('ogabassey');
      mockEq.mockImplementation((...args: unknown[]) => {
        const [key, value] = args as [string, string];
        if (key === 'merchant_id' && value === 'merchant-1') {
          return {
            data: [
              { slug: 'smartphones', updated_at: '2026-01-01T00:00:00Z' },
              { slug: 'accessories', updated_at: '2026-01-02T00:00:00Z' },
            ],
            error: null,
          };
        }

        return { eq: mockEq };
      });

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: Promise.resolve('categories') });

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://ogabassey.usebaci.com/smartphones');
      expect(result[1].url).toBe('https://ogabassey.usebaci.com/accessories');
    });

    it('throws when categories cannot be loaded', async () => {
      setSlugHeader('ogabassey');
      mockEq.mockImplementation((...args: unknown[]) => {
        const [key, value] = args as [string, string];
        if (key === 'merchant_id' && value === 'merchant-1') {
          return { data: null, error: new Error('db') };
        }

        return { eq: mockEq };
      });

      const { default: sitemap } = await import('./sitemap');

      await expect(
        sitemap({ id: Promise.resolve('categories') })
      ).rejects.toThrow('db');
    });
  });
});

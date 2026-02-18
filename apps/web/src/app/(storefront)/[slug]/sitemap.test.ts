import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Set env vars BEFORE any imports ----
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';

// ---- Mock state ----

// Supabase query builder mock — chainable
const mockSingle = vi.fn();
const mockEq: ReturnType<typeof vi.fn<(...args: any[]) => any>> = vi.fn(() => ({
  eq: mockEq,
  single: mockSingle,
}));
const mockSelect = vi.fn(() => ({ eq: mockEq, single: mockSingle }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

// Mock merchant returned by getRequestScopedMerchant
let mockMerchant: {
  id: string;
  slug: string;
  custom_domain?: string;
} | null = null;

const mockGetRequestScopedMerchant = vi.fn(() => Promise.resolve(mockMerchant));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: (
    ...args: Parameters<typeof mockGetRequestScopedMerchant>
  ) => mockGetRequestScopedMerchant(...args),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateSlug: vi.fn((str: string) => str.toLowerCase().replace(/\s+/g, '-')),
}));

// ---- Helper to create params promise ----
function makeParams(slug: string) {
  return Promise.resolve({ slug });
}

// ---- Tests ----

describe('sitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMerchant = {
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: undefined,
    };
    // Default: product/category/blog queries return empty
    mockSingle.mockResolvedValue({ data: { id: 'merchant-1' }, error: null });
  });

  describe('generateSitemaps()', () => {
    it('returns four sitemap IDs', async () => {
      const { generateSitemaps } = await import('./sitemap');

      const sitemaps = generateSitemaps();

      expect(sitemaps).toEqual([
        { id: 'static' },
        { id: 'products' },
        { id: 'categories' },
        { id: 'blog' },
      ]);
    });
  });

  describe('merchant lookup', () => {
    it('looks up merchant using route slug param', async () => {
      const { default: sitemap } = await import('./sitemap');

      await sitemap({ id: 'static', params: makeParams('ogabassey') });

      expect(mockGetRequestScopedMerchant).toHaveBeenCalledWith('ogabassey');
    });

    it('looks up merchant using custom domain route slug', async () => {
      mockMerchant = {
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      };
      const { default: sitemap } = await import('./sitemap');

      await sitemap({ id: 'static', params: makeParams('ogabassey.com') });

      // getRequestScopedMerchant handles both domain and slug identifiers
      expect(mockGetRequestScopedMerchant).toHaveBeenCalledWith(
        'ogabassey.com'
      );
    });

    it('returns empty array when merchant is not found', async () => {
      mockMerchant = null;

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({
        id: 'static',
        params: makeParams('unknown'),
      });

      expect(result).toEqual([]);
    });
  });

  describe('storeUrl construction', () => {
    it('uses custom_domain when available', async () => {
      mockMerchant = {
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      };

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({
        id: 'static',
        params: makeParams('ogabassey.com'),
      });

      expect(result[0].url).toBe('https://ogabassey.com');
    });

    it('falls back to subdomain URL when no custom_domain', async () => {
      mockMerchant = {
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: undefined,
      };

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({
        id: 'static',
        params: makeParams('ogabassey'),
      });

      expect(result[0].url).toBe('https://ogabassey.usebaci.com');
    });
  });

  describe('static sitemap', () => {
    it('returns store URL and FAQ page', async () => {
      mockMerchant = {
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      };

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({
        id: 'static',
        params: makeParams('ogabassey.com'),
      });

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://ogabassey.com');
      expect(result[0].priority).toBe(1);
      expect(result[1].url).toBe('https://ogabassey.com/faq');
      expect(result[1].priority).toBe(0.5);
    });
  });

  describe('products sitemap', () => {
    it('generates URLs with category slug when available', async () => {
      mockMerchant = {
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      };

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
      mockEq.mockImplementation((key: string, value: string) => {
        if (key === 'status' && value === 'active') {
          return { data: productData, error: null };
        }
        return { eq: mockEq, single: mockSingle };
      });

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({
        id: 'products',
        params: makeParams('ogabassey.com'),
      });

      expect(result[0].url).toBe('https://ogabassey.com/smartphones/iphone-15');
      expect(result[0].images).toEqual(['https://img.example.com/iphone.jpg']);
    });

    it('returns empty array when no products exist', async () => {
      mockEq.mockImplementation((key: string, value: string) => {
        if (key === 'status' && value === 'active') {
          return { data: null, error: null };
        }
        return { eq: mockEq, single: mockSingle };
      });

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({
        id: 'products',
        params: makeParams('ogabassey'),
      });

      expect(result).toEqual([]);
    });
  });

  describe('unknown sitemap id', () => {
    it('returns empty array for unrecognized id', async () => {
      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({
        id: 'unknown',
        params: makeParams('ogabassey'),
      });

      expect(result).toEqual([]);
    });
  });
});

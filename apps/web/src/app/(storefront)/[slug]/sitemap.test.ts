import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Set env vars BEFORE any imports ----
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// ---- Mock state ----

let mockHeaders: Record<string, string | null> = {};

// Supabase query builder mock — chainable
const mockSingle = vi.fn();
// biome-ignore lint/suspicious/noExplicitAny: Test mock needs flexible signature for chaining
const mockEq: ReturnType<typeof vi.fn<(...args: any[]) => any>> = vi.fn(() => ({
  eq: mockEq,
  single: mockSingle,
}));
const mockSelect = vi.fn(() => ({ eq: mockEq, single: mockSingle }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('next/headers', () => ({
  headers: vi.fn(() =>
    Promise.resolve({
      get: vi.fn((name: string) => mockHeaders[name] ?? null),
    })
  ),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateSlug: vi.fn((str: string) => str.toLowerCase().replace(/\s+/g, '-')),
}));

// ---- Tests ----

describe('sitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders = {
      host: 'ogabassey.usebaci.com',
      'x-merchant-slug': 'ogabassey',
    };
    // Default: merchant found via slug lookup
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
    it('looks up merchant by slug when x-merchant-slug header is present', async () => {
      const { default: sitemap } = await import('./sitemap');

      await sitemap({ id: 'static' });

      expect(mockFrom).toHaveBeenCalledWith('merchants');
      expect(mockSelect).toHaveBeenCalledWith('id');
      expect(mockEq).toHaveBeenCalledWith('slug', 'ogabassey');
    });

    it('looks up merchant by slug derived from x-custom-domain', async () => {
      mockHeaders = {
        host: 'ogabassey.com',
        'x-custom-domain': 'ogabassey.com',
      };
      mockSingle.mockResolvedValue({
        data: { id: 'merchant-1' },
        error: null,
      });

      const { default: sitemap } = await import('./sitemap');

      await sitemap({ id: 'static' });

      // The sitemap implementation converts custom domain to slug for merchants table lookup
      expect(mockFrom).toHaveBeenCalledWith('merchants');
      expect(mockSelect).toHaveBeenCalledWith('id');
      expect(mockEq).toHaveBeenCalledWith('slug', 'ogabassey');
    });

    it('derives slug from custom domain by removing .com and replacing dots', async () => {
      mockHeaders = {
        host: 'OgaBassey.COM',
        'x-custom-domain': 'OgaBassey.COM',
      };
      mockSingle.mockResolvedValue({
        data: { id: 'merchant-1' },
        error: null,
      });

      const { default: sitemap } = await import('./sitemap');

      await sitemap({ id: 'static' });

      // Slug is derived from domain after removing .com and replacing . with -
      expect(mockFrom).toHaveBeenCalledWith('merchants');
      expect(mockEq).toHaveBeenCalledWith('slug', 'OgaBassey-COM');
    });

    it('works with non-.com TLDs like .ng', async () => {
      mockHeaders = {
        host: 'ogabassey.ng',
        'x-custom-domain': 'ogabassey.ng',
      };
      mockSingle.mockResolvedValue({
        data: { id: 'merchant-1' },
        error: null,
      });

      const { default: sitemap } = await import('./sitemap');

      await sitemap({ id: 'static' });

      // For .ng domains, the .com is removed and . is replaced with -
      expect(mockFrom).toHaveBeenCalledWith('merchants');
      expect(mockEq).toHaveBeenCalledWith('slug', 'ogabassey-ng');
    });

    it('returns empty array when merchant is not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: 'static' });

      expect(result).toEqual([]);
    });

    it('falls back to default slug when no routing headers are set', async () => {
      mockHeaders = { host: 'ogabassey.localhost:3000' };

      const { default: sitemap } = await import('./sitemap');

      await sitemap({ id: 'static' });

      expect(mockFrom).toHaveBeenCalledWith('merchants');
      expect(mockEq).toHaveBeenCalledWith('slug', 'ogabassey');
    });
  });

  describe('static sitemap', () => {
    it('returns store URL and FAQ page', async () => {
      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: 'static' });

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://ogabassey.usebaci.com');
      expect(result[0].priority).toBe(1);
      expect(result[1].url).toBe('https://ogabassey.usebaci.com/faq');
      expect(result[1].priority).toBe(0.5);
    });
  });

  describe('products sitemap', () => {
    it('generates URLs with category slug when available', async () => {
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
      // First eq chain: merchant lookup (merchant_id)
      // Second eq chain: product query (status=active) → returns products
      mockSingle.mockResolvedValueOnce({
        data: { id: 'merchant-1' },
        error: null,
      });
      mockEq.mockImplementation((key: string, value: string) => {
        // When the status=active filter is applied, return product data
        if (key === 'status' && value === 'active') {
          return { data: productData, error: null };
        }
        return { eq: mockEq, single: mockSingle };
      });

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: 'products' });

      expect(result[0].url).toBe(
        'https://ogabassey.usebaci.com/smartphones/iphone-15'
      );
      expect(result[0].images).toEqual(['https://img.example.com/iphone.jpg']);
    });

    it('returns empty array when no products exist', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'merchant-1' },
        error: null,
      });
      mockEq.mockImplementation((key: string, value: string) => {
        if (key === 'status' && value === 'active') {
          return { data: null, error: null };
        }
        return { eq: mockEq, single: mockSingle };
      });

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: 'products' });

      expect(result).toEqual([]);
    });
  });

  describe('unknown sitemap id', () => {
    it('returns empty array for unrecognized id', async () => {
      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: 'unknown' });

      expect(result).toEqual([]);
    });
  });

  describe('storeUrl construction', () => {
    it('uses host header for sitemap URLs on custom domain', async () => {
      mockHeaders = {
        host: 'ogabassey.com',
        'x-custom-domain': 'ogabassey.com',
      };
      mockSingle.mockResolvedValue({
        data: { id: 'merchant-1' },
        error: null,
      });

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({ id: 'static' });

      expect(result[0].url).toBe('https://ogabassey.com');
    });
  });
});

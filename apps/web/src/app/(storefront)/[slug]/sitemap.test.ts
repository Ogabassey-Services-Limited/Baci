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
    // Default: merchant found via slug lookup
    mockSingle.mockResolvedValue({ data: { id: 'merchant-1' }, error: null });
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
    it('looks up merchant by slug from route params', async () => {
      const { default: sitemap } = await import('./sitemap');

      await sitemap({ id: 'static', params: makeParams('ogabassey') });

      expect(mockFrom).toHaveBeenCalledWith('merchants');
      expect(mockSelect).toHaveBeenCalledWith('id');
      expect(mockEq).toHaveBeenCalledWith('slug', 'ogabassey');
    });

    it('derives slug from custom domain route param (removes .com)', async () => {
      const { default: sitemap } = await import('./sitemap');

      await sitemap({ id: 'static', params: makeParams('ogabassey.com') });

      expect(mockFrom).toHaveBeenCalledWith('merchants');
      expect(mockEq).toHaveBeenCalledWith('slug', 'ogabassey');
    });

    it('derives slug from non-.com TLDs like .ng', async () => {
      const { default: sitemap } = await import('./sitemap');

      await sitemap({ id: 'static', params: makeParams('ogabassey.ng') });

      // .com is removed first (no-op for .ng), then remaining dots become hyphens
      expect(mockEq).toHaveBeenCalledWith('slug', 'ogabassey-ng');
    });

    it('returns empty array when merchant is not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({
        id: 'static',
        params: makeParams('unknown'),
      });

      expect(result).toEqual([]);
    });
  });

  describe('storeUrl construction', () => {
    it('uses custom domain directly when route slug is a domain', async () => {
      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({
        id: 'static',
        params: makeParams('ogabassey.com'),
      });

      expect(result[0].url).toBe('https://ogabassey.com');
    });

    it('builds subdomain URL when route slug is a plain slug', async () => {
      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({
        id: 'static',
        params: makeParams('ogabassey'),
      });

      expect(result[0].url).toBe('https://ogabassey.usebaci.com');
    });
  });

  describe('static sitemap', () => {
    it('returns store URL, products page, and FAQ page', async () => {
      const { default: sitemap } = await import('./sitemap');

      const result = await sitemap({
        id: 'static',
        params: makeParams('ogabassey.com'),
      });

      expect(result).toHaveLength(3);
      expect(result[0].url).toBe('https://ogabassey.com');
      expect(result[0].priority).toBe(1);
      expect(result[1].url).toBe('https://ogabassey.com/products');
      expect(result[1].priority).toBe(0.8);
      expect(result[2].url).toBe('https://ogabassey.com/faq');
      expect(result[2].priority).toBe(0.5);
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
      mockSingle.mockResolvedValueOnce({
        data: { id: 'merchant-1' },
        error: null,
      });
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

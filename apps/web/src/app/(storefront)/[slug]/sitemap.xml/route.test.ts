import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Env vars (before any imports that read them) ──

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';

// ── Mocks ──

// Table-aware Supabase mock: mockFrom tracks which table is being queried,
// so eq/select return the correct data per table instead of relying on argument ordering.
let currentTable = '';

const tableData: Record<string, { data: unknown[]; error: null }> = {
  products: { data: [], error: null },
  categories: { data: [], error: null },
  blog_posts: { data: [], error: null },
};

const mockEq: ReturnType<typeof vi.fn> = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

mockEq.mockImplementation((_key: string, _value: string) => {
  // Terminal eq in the chain (e.g. .eq('status','active')) returns table data
  // Intermediate eq (e.g. .eq('merchant_id',...)) continues the chain
  if (_key === 'status' || _key === 'merchant_id') {
    const result = tableData[currentTable] ?? { data: [], error: null };
    // Return chainable + data so both terminal and intermediate calls work
    return { eq: mockEq, ...result };
  }
  return { eq: mockEq, data: [], error: null };
});

mockSelect.mockImplementation(() => ({ eq: mockEq }));
mockFrom.mockImplementation((table: string) => {
  currentTable = table;
  return { select: mockSelect };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    NEXT_PUBLIC_ROOT_DOMAIN: 'usebaci.com',
  },
}));

// Mock getMerchantByIdentifier
const mockGetMerchant = vi.fn();
vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) => mockGetMerchant(...args),
}));

vi.mock('@/lib/seo-utils', () => ({
  generateSlug: vi.fn((str: string) =>
    str
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
  ),
}));

// Mock next/headers
let mockHeaders = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => mockHeaders.get(key) ?? null,
  })),
}));

// ── Helpers ──

function setHeaders(h: Record<string, string>) {
  mockHeaders = new Map(Object.entries(h));
}

const baseMerchant = {
  id: 'merchant-1',
  slug: 'ogabassey',
  business_name: 'Ogabassey',
  custom_domain: 'ogabassey.com',
  site_title: '',
  site_tagline: '',
  site_description: '',
  business_type: 'electronics',
  logo_url: '',
  phone: '',
  email: '',
  brand_colors: { primary: '#000', accent: '#fff', background: '#fff' },
  business_address: '',
  payout_currency: 'NGN',
  is_published: true,
  template_id: 'ogabassey',
  plan_tier: 'pro',
  premium_features: null,
  updated_at: '2026-01-20T12:00:00Z',
};

function setTableData(table: string, data: unknown[]) {
  tableData[table] = { data, error: null };
}

function resetTableData() {
  tableData.products = { data: [], error: null };
  tableData.categories = { data: [], error: null };
  tableData.blog_posts = { data: [], error: null };
}

// ── Tests ──

describe('GET /[slug]/sitemap.xml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders = new Map();
    mockGetMerchant.mockResolvedValue(null);
    resetTableData();
  });

  it('returns 404 when no merchant headers are present', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(404);
  });

  it('returns 404 when merchant is not found', async () => {
    setHeaders({ 'x-custom-domain': 'unknown-store.com' });
    mockGetMerchant.mockResolvedValue(null);

    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(404);
  });

  it('detects merchant from x-custom-domain header', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);

    const { GET } = await import('./route');
    await GET();

    expect(mockGetMerchant).toHaveBeenCalledWith('ogabassey.com');
  });

  it('detects merchant from x-merchant-slug header', async () => {
    setHeaders({ 'x-merchant-slug': 'ogabassey' });
    mockGetMerchant.mockResolvedValue(baseMerchant);

    const { GET } = await import('./route');
    await GET();

    expect(mockGetMerchant).toHaveBeenCalledWith('ogabassey');
  });

  it('prefers x-custom-domain over x-merchant-slug', async () => {
    setHeaders({
      'x-custom-domain': 'ogabassey.com',
      'x-merchant-slug': 'ogabassey',
    });
    mockGetMerchant.mockResolvedValue(baseMerchant);

    const { GET } = await import('./route');
    await GET();

    expect(mockGetMerchant).toHaveBeenCalledWith('ogabassey.com');
  });

  it('returns Content-Type application/xml', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.headers.get('Content-Type')).toBe(
      'application/xml; charset=utf-8'
    );
  });

  it('returns Cache-Control with s-maxage=21600', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.headers.get('Cache-Control')).toContain('s-maxage=21600');
  });

  it('returns valid XML (not HTML)', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.text();

    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain('<urlset');
    expect(body).toContain('</urlset>');
    expect(body).not.toContain('<!DOCTYPE html');
    expect(body).not.toContain('<html');
  });

  it('includes static pages with lastmod from merchant.updated_at', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.text();

    expect(body).toContain('<loc>https://ogabassey.com</loc>');
    expect(body).toContain('<loc>https://ogabassey.com/faq</loc>');
    // lastmod should be merchant.updated_at, not a volatile new Date()
    expect(body).toContain(
      `<lastmod>${new Date('2026-01-20T12:00:00Z').toISOString()}</lastmod>`
    );
  });

  it('omits lastmod when merchant has no updated_at', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue({
      ...baseMerchant,
      updated_at: undefined,
    });

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.text();

    // Static pages should still appear but without <lastmod>
    expect(body).toContain('<loc>https://ogabassey.com</loc>');
    // Count lastmod occurrences — should be zero for static pages
    const homepageEntry = body.split('<loc>https://ogabassey.com</loc>')[1];
    const nextUrlStart = homepageEntry?.indexOf('<url>') ?? -1;
    const segment =
      nextUrlStart > 0 ? homepageEntry?.slice(0, nextUrlStart) : homepageEntry;
    expect(segment).not.toContain('<lastmod>');
  });

  it('uses custom_domain for store URL when available', async () => {
    setHeaders({ 'x-merchant-slug': 'ogabassey' });
    mockGetMerchant.mockResolvedValue(baseMerchant);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.text();

    // custom_domain = ogabassey.com, so URLs should use that
    expect(body).toContain('<loc>https://ogabassey.com</loc>');
  });

  it('uses subdomain URL when custom_domain is not set', async () => {
    setHeaders({ 'x-merchant-slug': 'teststore' });
    mockGetMerchant.mockResolvedValue({
      ...baseMerchant,
      slug: 'teststore',
      custom_domain: undefined,
    });

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.text();

    expect(body).toContain('<loc>https://teststore.usebaci.com</loc>');
  });

  it('includes product URLs with category paths', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);
    setTableData('products', [
      {
        id: 'p1',
        slug: 'iphone-15',
        category: 'Smartphones',
        images: ['https://img.example.com/iphone.jpg'],
        updated_at: '2026-01-15T00:00:00Z',
        category_id: 'cat-1',
        categories: { slug: 'smartphones' },
      },
    ]);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.text();

    expect(body).toContain(
      '<loc>https://ogabassey.com/smartphones/iphone-15</loc>'
    );
    expect(body).toContain(
      '<image:loc>https://img.example.com/iphone.jpg</image:loc>'
    );
  });

  it('uses /products/ fallback when no category slug exists', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);
    setTableData('products', [
      {
        id: 'p2',
        slug: 'random-gadget',
        category: null,
        images: null,
        updated_at: null,
        category_id: null,
        categories: null,
      },
    ]);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.text();

    expect(body).toContain(
      '<loc>https://ogabassey.com/products/random-gadget</loc>'
    );
  });

  it('includes category URLs in sitemap', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);
    setTableData('categories', [
      { slug: 'smartphones', updated_at: '2026-01-10T00:00:00Z' },
      { slug: 'laptops', updated_at: null },
    ]);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.text();

    expect(body).toContain('<loc>https://ogabassey.com/smartphones</loc>');
    expect(body).toContain('<loc>https://ogabassey.com/laptops</loc>');
    // Category with updated_at should use it
    expect(body).toContain(
      `<lastmod>${new Date('2026-01-10T00:00:00Z').toISOString()}</lastmod>`
    );
  });

  it('includes blog posts with /blog index and image tags', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);
    setTableData('blog_posts', [
      {
        slug: 'ai-ecommerce',
        published_at: '2026-01-05T00:00:00Z',
        updated_at: '2026-01-18T00:00:00Z',
        featured_image_url: 'https://img.example.com/blog-hero.jpg',
      },
    ]);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.text();

    // Blog index page
    expect(body).toContain('<loc>https://ogabassey.com/blog</loc>');
    // Individual blog post
    expect(body).toContain(
      '<loc>https://ogabassey.com/blog/ai-ecommerce</loc>'
    );
    // Blog post image
    expect(body).toContain(
      '<image:loc>https://img.example.com/blog-hero.jpg</image:loc>'
    );
  });

  it('returns 500 when an unexpected error occurs', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    // Make getMerchantByIdentifier throw to trigger the catch block
    mockGetMerchant.mockRejectedValue(new Error('DB connection failed'));

    const { GET } = await import('./route');
    const response = await GET();

    expect(response.status).toBe(500);
  });

  it('sanitizes header values (strips newlines)', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com\r\ninjected' });
    mockGetMerchant.mockResolvedValue(baseMerchant);

    const { GET } = await import('./route');
    await GET();

    expect(mockGetMerchant).toHaveBeenCalledWith('ogabassey.cominjected');
  });
});

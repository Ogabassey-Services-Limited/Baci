import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Env vars (before any imports that read them) ──

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';

// ── Mocks ──

// Supabase chainable query builder
const mockEq: ReturnType<typeof vi.fn> = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

// Configure chainable returns
mockEq.mockImplementation(() => ({ eq: mockEq, data: null, error: null }));
mockSelect.mockImplementation(() => ({ eq: mockEq }));
mockFrom.mockImplementation(() => ({ select: mockSelect }));

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
};

function setupProductsQuery(products: unknown[]) {
  // The product query chain: from('products').select(...).eq('merchant_id',...).eq('status','active')
  mockEq.mockImplementation((key: string, value: string) => {
    if (key === 'status' && value === 'active') {
      return { data: products, error: null };
    }
    if (key === 'status' && value === 'published') {
      return { data: [], error: null };
    }
    return { eq: mockEq };
  });
}

function setupAllQueriesEmpty() {
  // All queries return empty arrays
  mockEq.mockImplementation((key: string, _value: string) => {
    if (key === 'status') {
      return { data: [], error: null };
    }
    if (key === 'merchant_id') {
      return { eq: mockEq, data: [], error: null };
    }
    return { eq: mockEq, data: [], error: null };
  });
}

// ── Tests ──

describe('GET /[slug]/sitemap.xml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders = new Map();
    mockGetMerchant.mockResolvedValue(null);
    setupAllQueriesEmpty();
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

  it('includes static pages (homepage + faq) for empty store', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.text();

    expect(body).toContain('<loc>https://ogabassey.com</loc>');
    expect(body).toContain('<loc>https://ogabassey.com/faq</loc>');
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
    setupProductsQuery([
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
    setupProductsQuery([
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

  it('sanitizes header values (strips newlines)', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com\r\ninjected' });
    mockGetMerchant.mockResolvedValue(baseMerchant);

    const { GET } = await import('./route');
    await GET();

    expect(mockGetMerchant).toHaveBeenCalledWith('ogabassey.cominjected');
  });
});

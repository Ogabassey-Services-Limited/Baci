import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  baseMerchant,
  mockFrom,
  mockGetMerchant,
  mockHeaders,
  resetTableData,
  setHeaders,
  setTableData,
  setTableError,
} from './route.test-helpers';

// ── Env vars (before any imports that read them) ──

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'usebaci.com';

// ── vi.mock calls (must stay in test file — Vitest hoists them) ──

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

vi.mock('next/headers', async () => {
  const helpers = await import('./route.test-helpers');
  return {
    headers: vi.fn(async () => ({
      get: (key: string) => helpers.mockHeaders.get(key) ?? null,
    })),
  };
});

// ── Tests ──

describe('GET /[slug]/sitemap.xml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutable state in helpers module
    mockHeaders.clear();
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
    expect((await GET()).status).toBe(404);
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
    const body = await (await GET()).text();
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain('<urlset');
    expect(body).not.toContain('<html');
  });

  it('includes static pages with lastmod from merchant.updated_at', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);
    const { GET } = await import('./route');
    const body = await (await GET()).text();
    expect(body).toContain('<loc>https://ogabassey.com</loc>');
    expect(body).toContain(
      `<lastmod>${new Date('2026-01-20T12:00:00Z').toISOString()}</lastmod>`
    );
  });

  it('includes /faq only when merchant has FAQ content', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    // baseMerchant has no faq_items and no pages.faq — should omit /faq
    mockGetMerchant.mockResolvedValue(baseMerchant);
    const { GET } = await import('./route');
    const body = await (await GET()).text();
    expect(body).not.toContain('<loc>https://ogabassey.com/faq</loc>');
  });

  it('includes /faq when merchant has faq_items', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue({
      ...baseMerchant,
      faq_items: [{ question: 'Q1', answer: 'A1' }],
    });
    const { GET } = await import('./route');
    const body = await (await GET()).text();
    expect(body).toContain('<loc>https://ogabassey.com/faq</loc>');
  });

  it('includes /faq when merchant has pages.faq', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue({
      ...baseMerchant,
      pages: { faq: '<h2>Q1</h2><p>A1</p>' },
    });
    const { GET } = await import('./route');
    const body = await (await GET()).text();
    expect(body).toContain('<loc>https://ogabassey.com/faq</loc>');
  });

  it('omits lastmod when merchant has no updated_at', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue({
      ...baseMerchant,
      updated_at: undefined,
    });
    const { GET } = await import('./route');
    const body = await (await GET()).text();
    expect(body).toContain('<loc>https://ogabassey.com</loc>');
    // With empty tables and no updated_at, no lastmod should appear anywhere
    expect(body).not.toContain('<lastmod>');
  });

  it('uses custom_domain for store URL when available', async () => {
    setHeaders({ 'x-merchant-slug': 'ogabassey' });
    mockGetMerchant.mockResolvedValue(baseMerchant);
    const { GET } = await import('./route');
    const body = await (await GET()).text();
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
    const body = await (await GET()).text();
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
    const body = await (await GET()).text();
    expect(body).toContain(
      '<loc>https://ogabassey.com/smartphones/iphone-15</loc>'
    );
    expect(body).toContain(
      '<image:loc>https://img.example.com/iphone.jpg</image:loc>'
    );
  });

  it('uses generateSlug on category text when categories join is null', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);
    setTableData('products', [
      {
        id: 'p3',
        slug: 'galaxy-buds',
        category: 'Audio Equipment',
        images: null,
        updated_at: null,
        category_id: null,
        categories: null,
      },
    ]);
    const { GET } = await import('./route');
    const body = await (await GET()).text();
    expect(body).toContain(
      '<loc>https://ogabassey.com/audio-equipment/galaxy-buds</loc>'
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
    const body = await (await GET()).text();
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
    const body = await (await GET()).text();
    expect(body).toContain('<loc>https://ogabassey.com/smartphones</loc>');
    expect(body).toContain('<loc>https://ogabassey.com/laptops</loc>');
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
    const body = await (await GET()).text();
    expect(body).toContain('<loc>https://ogabassey.com/blog</loc>');
    expect(body).toContain(
      '<loc>https://ogabassey.com/blog/ai-ecommerce</loc>'
    );
    expect(body).toContain(
      '<image:loc>https://img.example.com/blog-hero.jpg</image:loc>'
    );
  });

  it('includes merchant.pages entries when present', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue({
      ...baseMerchant,
      pages: { about: 'About us', terms: 'Terms of service', privacy: null },
    });
    const { GET } = await import('./route');
    const body = await (await GET()).text();
    expect(body).toContain('<loc>https://ogabassey.com/about</loc>');
    expect(body).toContain('<loc>https://ogabassey.com/terms</loc>');
    expect(body).not.toContain('<loc>https://ogabassey.com/privacy</loc>');
  });

  it('returns 500 when an unexpected error occurs', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockRejectedValue(new Error('DB connection failed'));
    const { GET } = await import('./route');
    expect((await GET()).status).toBe(500);
  });

  it('returns 503 when all Supabase queries fail', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);
    setTableError('products', 'connection refused');
    setTableError('categories', 'connection refused');
    setTableError('blog_posts', 'connection refused');
    const { GET } = await import('./route');
    expect((await GET()).status).toBe(503);
  });

  it('degrades gracefully when only some queries fail', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com' });
    mockGetMerchant.mockResolvedValue(baseMerchant);
    setTableError('products', 'timeout');
    // categories and blog_posts succeed (empty)
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.text();
    // Static pages still present
    expect(body).toContain('<loc>https://ogabassey.com</loc>');
    // No product entries since products query failed
    expect(body).not.toContain('/products/');
  });

  it('sanitizes header values (strips newlines)', async () => {
    setHeaders({ 'x-custom-domain': 'ogabassey.com\r\ninjected' });
    mockGetMerchant.mockResolvedValue(baseMerchant);
    const { GET } = await import('./route');
    await GET();
    expect(mockGetMerchant).toHaveBeenCalledWith('ogabassey.cominjected');
  });
});

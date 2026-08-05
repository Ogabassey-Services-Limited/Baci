import { describe, expect, it, vi } from 'vitest';

const mockResolveStorefrontSitemapContext = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('../../sitemap-data', () => ({
  resolveStorefrontSitemapContext: (...args: unknown[]) =>
    mockResolveStorefrontSitemapContext(...args),
}));

describe('blog sitemap publication', () => {
  it('returns no public URLs for an unpublished storefront', async () => {
    mockResolveStorefrontSitemapContext.mockResolvedValueOnce({
      merchant: {
        id: 'merchant-1',
        slug: 'zorvexa',
        is_published: false,
        feature_settings: { blog_enabled: true },
      },
      storeUrl: 'https://zorvexa.usebaci.com',
      supabase: {
        from: () => {
          throw new Error('unpublished blog sitemap must not query');
        },
      },
    });

    const { default: sitemap } = await import('./sitemap');

    await expect(sitemap()).resolves.toEqual([]);
  });
});

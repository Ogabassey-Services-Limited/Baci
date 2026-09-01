import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockScheduleBlogPurge,
  mockRevalidateProducts,
  mockRevalidateProductSlugs,
  mockRevalidateDashboard,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockScheduleBlogPurge: vi.fn(),
  mockRevalidateProducts: vi.fn(),
  mockRevalidateProductSlugs: vi.fn(),
  mockRevalidateDashboard: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('@/lib/schedule-order-product-blog-purge-after-response', () => ({
  scheduleOrderProductBlogPurgeAfterResponse: (...args: unknown[]) =>
    mockScheduleBlogPurge(...args),
}));
vi.mock('@/lib/product-cache-revalidation', () => ({
  productCacheRevalidation: {
    revalidateDashboard: (...args: unknown[]) =>
      mockRevalidateDashboard(...args),
    revalidateProductSlugs: (...args: unknown[]) =>
      mockRevalidateProductSlugs(...args),
    revalidateProducts: (...args: unknown[]) => mockRevalidateProducts(...args),
  },
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mockLoggerError } }));
vi.mock('@/lib/sanitize-core', () => ({
  sanitizeForLog: (value: unknown) => value,
}));

import { revalidateAgenticOrderProductCaches } from './revalidate-agentic-order-product-caches';

function makeSupabase(result: { data: unknown; error: unknown }) {
  const chain = {
    eq: vi.fn(),
    in: vi.fn(),
    returns: vi.fn().mockResolvedValue(result),
    select: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return { from: vi.fn().mockReturnValue(chain) };
}

describe('revalidateAgenticOrderProductCaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revalidates tracked product slugs and queues the article lookup', async () => {
    const supabase = makeSupabase({
      data: [{ id: 'product-1', manage_stock: true, slug: 'phone-1' }],
      error: null,
    });

    await revalidateAgenticOrderProductCaches({
      merchantId: 'merchant-1',
      productIds: ['product-1'],
      sessionId: 'session-1',
      slugLookupFailureMessage: 'slug lookup failed',
      outerFailureMessage: 'cache revalidation failed',
      supabase: supabase as never,
    });

    expect(mockScheduleBlogPurge).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      productIds: ['product-1'],
      supabase,
    });
    expect(mockRevalidateProducts).toHaveBeenCalledWith(
      'merchant-1',
      undefined,
      { feedScope: 'merchant' }
    );
    expect(mockRevalidateProductSlugs).toHaveBeenCalledWith('merchant-1', [
      'phone-1',
    ]);
  });

  it('does not queue an article purge for unlimited-stock products', async () => {
    const supabase = makeSupabase({
      data: [{ id: 'product-1', manage_stock: false, slug: 'phone-1' }],
      error: null,
    });

    await revalidateAgenticOrderProductCaches({
      merchantId: 'merchant-1',
      productIds: ['product-1'],
      sessionId: 'session-1',
      slugLookupFailureMessage: 'slug lookup failed',
      outerFailureMessage: 'cache revalidation failed',
      supabase: supabase as never,
    });

    expect(mockScheduleBlogPurge).not.toHaveBeenCalled();
    expect(mockRevalidateDashboard).toHaveBeenCalledWith('merchant-1');
  });

  it('fails open when the slug query errors', async () => {
    const supabase = makeSupabase({
      data: null,
      error: new Error('timeout'),
    });

    await expect(
      revalidateAgenticOrderProductCaches({
        merchantId: 'merchant-1',
        productIds: ['product-1'],
        sessionId: 'session-1',
        slugLookupFailureMessage: 'slug lookup failed',
        outerFailureMessage: 'cache revalidation failed',
        supabase: supabase as never,
      })
    ).resolves.toBeUndefined();
    expect(mockLoggerError).toHaveBeenCalled();
  });
});

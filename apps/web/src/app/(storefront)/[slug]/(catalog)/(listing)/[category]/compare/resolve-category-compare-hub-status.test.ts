import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedCategories,
  getMerchantByIdentifier,
} from '@/lib/cached-data';
import { buildCategoryCompareHubLinks } from './category-compare-hub-links';
import { loadCategoryCompareHubData } from './load-category-compare-hub-data';
import { resolveCategoryCompareHubStatus } from './resolve-category-compare-hub-status';

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: vi.fn(),
  getCachedCategories: vi.fn(),
}));

vi.mock('./load-category-compare-hub-data', () => ({
  loadCategoryCompareHubData: vi.fn(),
}));

vi.mock('./category-compare-hub-links', () => ({
  buildCategoryCompareHubLinks: vi.fn(),
}));

type Merchant = Awaited<ReturnType<typeof getMerchantByIdentifier>>;
type Category = Awaited<ReturnType<typeof getCachedCategories>>[number];

function merchant(overrides: { is_published?: boolean } = {}): Merchant {
  return {
    id: 'merchant-1',
    business_name: 'Ogabassey',
    is_published: overrides.is_published ?? true,
  } as unknown as Merchant;
}

function category(): Category {
  return {
    id: 'cat-1',
    name: 'Printers',
    slug: 'printers',
    is_active: true,
    parent_id: null,
  } as unknown as Category;
}

function hubData(overrides: { inventoryDegraded?: boolean } = {}) {
  return {
    categoryName: 'Printers',
    categorySlug: 'printers',
    merchant: merchant(),
    productGroups: [],
    products: [],
    inventoryDegraded: overrides.inventoryDegraded ?? false,
    storeUrl: 'https://ogabassey.com',
  } as unknown as NonNullable<
    Awaited<ReturnType<typeof loadCategoryCompareHubData>>
  >;
}

const input = { merchantSlug: 'ogabassey', categorySlug: 'printers' };

describe('resolveCategoryCompareHubStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMerchantByIdentifier).mockResolvedValue(merchant());
    vi.mocked(getCachedCategories).mockResolvedValue([category()]);
    vi.mocked(loadCategoryCompareHubData).mockResolvedValue(hubData());
    vi.mocked(buildCategoryCompareHubLinks).mockReturnValue([]);
  });

  it('resolves empty for a genuinely unknown storefront (merchant not found)', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue(null);

    await expect(resolveCategoryCompareHubStatus(input)).resolves.toEqual({
      kind: 'empty',
    });
    expect(loadCategoryCompareHubData).not.toHaveBeenCalled();
  });

  it('fails open (unknown, uncached) for a draft/unpublished store — the layout serves coming-soon 200', async () => {
    vi.mocked(getMerchantByIdentifier).mockResolvedValue(
      merchant({ is_published: false })
    );

    await expect(resolveCategoryCompareHubStatus(input)).resolves.toEqual({
      kind: 'unknown',
    });
    expect(loadCategoryCompareHubData).not.toHaveBeenCalled();
  });

  it('fails open (unknown, uncached) when the categories load is degraded/empty (transient outage)', async () => {
    // getCachedCategories swallows query errors and returns [] — a store-wide
    // categories outage must never hard-404 every live hub.
    vi.mocked(getCachedCategories).mockResolvedValue([]);

    await expect(resolveCategoryCompareHubStatus(input)).resolves.toEqual({
      kind: 'unknown',
    });
    expect(loadCategoryCompareHubData).not.toHaveBeenCalled();
  });

  it('resolves empty for a genuinely absent category on an established store', async () => {
    // Categories loaded non-empty but the hub loader still returns null: the
    // slug is genuinely absent — hard-404 (crawl-trap closure).
    vi.mocked(loadCategoryCompareHubData).mockResolvedValue(null);

    await expect(resolveCategoryCompareHubStatus(input)).resolves.toEqual({
      kind: 'empty',
    });
  });

  it('resolves empty when the hub yields zero compare links on healthy inventory', async () => {
    vi.mocked(buildCategoryCompareHubLinks).mockReturnValue([]);

    await expect(resolveCategoryCompareHubStatus(input)).resolves.toEqual({
      kind: 'empty',
    });
  });

  it('resolves renderable with merchantId (for cache tagging) when the hub has a compare link', async () => {
    vi.mocked(buildCategoryCompareHubLinks).mockReturnValue([
      {
        href: '/printers/compare/a-vs-b',
        label: 'A vs B',
        description: 'Compare A and B',
      },
    ] as ReturnType<typeof buildCategoryCompareHubLinks>);

    await expect(resolveCategoryCompareHubStatus(input)).resolves.toEqual({
      kind: 'renderable',
      merchantId: 'merchant-1',
    });
  });

  it('resolves unknown (fail-open, uncached) when inventory is degraded even with zero links', async () => {
    vi.mocked(loadCategoryCompareHubData).mockResolvedValue(
      hubData({ inventoryDegraded: true })
    );

    await expect(resolveCategoryCompareHubStatus(input)).resolves.toEqual({
      kind: 'unknown',
    });
    expect(buildCategoryCompareHubLinks).not.toHaveBeenCalled();
  });

  it('propagates loader failures so the route can serve its fail-open body', async () => {
    vi.mocked(loadCategoryCompareHubData).mockRejectedValue(
      new Error('inventory query failed')
    );

    await expect(resolveCategoryCompareHubStatus(input)).rejects.toThrow(
      'inventory query failed'
    );
  });
});

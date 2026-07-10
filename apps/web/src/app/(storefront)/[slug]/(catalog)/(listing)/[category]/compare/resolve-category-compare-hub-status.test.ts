import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCategoryCompareHubLinks } from './category-compare-hub-links';
import { loadCategoryCompareHubData } from './load-category-compare-hub-data';
import { resolveCategoryCompareHubStatus } from './resolve-category-compare-hub-status';

vi.mock('./load-category-compare-hub-data', () => ({
  loadCategoryCompareHubData: vi.fn(),
}));

vi.mock('./category-compare-hub-links', () => ({
  buildCategoryCompareHubLinks: vi.fn(),
}));

function buildHubData(overrides: { inventoryDegraded?: boolean } = {}) {
  return {
    categoryName: 'Printers',
    categorySlug: 'printers',
    merchant: { id: 'merchant-1', business_name: 'Ogabassey' },
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
  });

  it('resolves empty for an unknown merchant or category (loader returns null)', async () => {
    vi.mocked(loadCategoryCompareHubData).mockResolvedValue(null);

    await expect(resolveCategoryCompareHubStatus(input)).resolves.toEqual({
      kind: 'empty',
    });
    expect(buildCategoryCompareHubLinks).not.toHaveBeenCalled();
  });

  it('resolves empty when the hub yields zero compare links on healthy inventory', async () => {
    vi.mocked(loadCategoryCompareHubData).mockResolvedValue(buildHubData());
    vi.mocked(buildCategoryCompareHubLinks).mockReturnValue([]);

    await expect(resolveCategoryCompareHubStatus(input)).resolves.toEqual({
      kind: 'empty',
    });
  });

  it('resolves renderable when the hub has at least one compare link', async () => {
    vi.mocked(loadCategoryCompareHubData).mockResolvedValue(buildHubData());
    vi.mocked(buildCategoryCompareHubLinks).mockReturnValue([
      {
        href: '/printers/compare/a-vs-b',
        label: 'A vs B',
        description: 'Compare A and B',
      },
    ] as ReturnType<typeof buildCategoryCompareHubLinks>);

    await expect(resolveCategoryCompareHubStatus(input)).resolves.toEqual({
      kind: 'renderable',
    });
  });

  it('resolves renderable (fail-open) when inventory is degraded even with zero links', async () => {
    vi.mocked(loadCategoryCompareHubData).mockResolvedValue(
      buildHubData({ inventoryDegraded: true })
    );

    await expect(resolveCategoryCompareHubStatus(input)).resolves.toEqual({
      kind: 'renderable',
    });
    expect(buildCategoryCompareHubLinks).not.toHaveBeenCalled();
  });

  it('propagates loader failures so the route can serve its fail-open body', async () => {
    vi.mocked(loadCategoryCompareHubData).mockRejectedValue(
      new Error('merchant lookup failed')
    );

    await expect(resolveCategoryCompareHubStatus(input)).rejects.toThrow(
      'merchant lookup failed'
    );
  });
});

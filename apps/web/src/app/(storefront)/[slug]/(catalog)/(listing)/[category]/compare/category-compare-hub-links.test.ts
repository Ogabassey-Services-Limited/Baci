import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCompareLinkGraph } from '@/lib/storefront-link-modules/compare-link-graph';
import {
  buildCategoryCompareHubLinks,
  type CategoryCompareHubData,
} from './category-compare-hub-links';

vi.mock('@/lib/storefront-link-modules/compare-link-graph', () => ({
  buildCompareLinkGraph: vi.fn(),
}));

function buildLink(index: number) {
  return {
    href: `/laptops/compare/pair-${index}`,
    label: `Pair ${index}`,
    description: `Compare pair ${index}`,
  } as ReturnType<typeof buildCompareLinkGraph>[number];
}

function buildHubData(
  overrides: Partial<CategoryCompareHubData> = {}
): CategoryCompareHubData {
  return {
    categoryName: 'Laptops',
    categorySlug: 'laptops',
    merchant: { id: 'merchant-1', business_name: 'Ogabassey' },
    productGroups: [],
    products: [],
    inventoryDegraded: false,
    storeUrl: 'https://ogabassey.com',
    ...overrides,
  } as CategoryCompareHubData;
}

describe('buildCategoryCompareHubLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildCompareLinkGraph).mockReturnValue([]);
  });

  it('falls back to a single top-level group when no product groups exist', () => {
    const data = buildHubData();

    buildCategoryCompareHubLinks(data);

    expect(buildCompareLinkGraph).toHaveBeenCalledTimes(1);
    expect(buildCompareLinkGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        categorySlug: 'laptops',
        categoryName: 'Laptops',
        productsAreKnownActive: true,
        maxLinks: 48,
      })
    );
  });

  it('splits the link budget across groups without dropping below the per-group minimum', () => {
    const groups = Array.from({ length: 12 }, (_, index) => ({
      categoryName: `Group ${index}`,
      categorySlug: `group-${index}`,
      products: [],
    }));
    const data = buildHubData({
      productGroups: groups,
    } as Partial<CategoryCompareHubData>);

    buildCategoryCompareHubLinks(data);

    expect(buildCompareLinkGraph).toHaveBeenCalledTimes(12);
    // ceil(48 / 12) = 4, clamped up to the per-group minimum of 6.
    expect(buildCompareLinkGraph).toHaveBeenCalledWith(
      expect.objectContaining({ maxLinks: 6 })
    );
  });

  it('caps the combined output at the hub link limit', () => {
    const groups = Array.from({ length: 2 }, (_, index) => ({
      categoryName: `Group ${index}`,
      categorySlug: `group-${index}`,
      products: [],
    }));
    const data = buildHubData({
      productGroups: groups,
    } as Partial<CategoryCompareHubData>);
    vi.mocked(buildCompareLinkGraph).mockImplementation(() =>
      Array.from({ length: 30 }, (_, index) => buildLink(index))
    );

    const links = buildCategoryCompareHubLinks(data);

    expect(links).toHaveLength(48);
  });
});

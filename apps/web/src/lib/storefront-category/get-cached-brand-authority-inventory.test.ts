import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHydrate = vi.fn();
const mockRange = vi.fn();
const query = Object.fromEntries(
  ['select', 'eq', 'or', 'ilike', 'order'].map((name) => [name, vi.fn()])
) as Record<string, ReturnType<typeof vi.fn>>;
for (const method of Object.values(query))
  method.mockReturnValue({ ...query, range: mockRange });
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/hydrate-public-products', () => ({
  hydrateAndSanitizePublicProducts: (...args: unknown[]) =>
    mockHydrate(...args),
}));
vi.mock('@/lib/storefront-category/brand-authority-public-data', () => ({
  brandAuthorityPublicData: {
    createClient: () => ({
      from: () => ({ ...query, range: mockRange }),
    }),
  },
}));

describe('getCachedBrandAuthorityInventory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hydrates availability and marks a full qualifying page as a lower bound', async () => {
    const products = Array.from({ length: 100 }, (_, index) => ({
      id: `p-${index}`,
      stock: 1,
      manage_stock: true,
      updated_at: '2026-01-01',
    }));
    mockRange.mockResolvedValue({ data: products, error: null });
    mockHydrate.mockResolvedValue(products);
    const { getCachedBrandAuthorityInventory } = await import(
      './get-cached-brand-authority-inventory'
    );
    const result = await getCachedBrandAuthorityInventory(
      'merchant-1',
      'smartphones',
      { brandQueryValue: 'Samsung', minimumProducts: 5 } as never
    );
    expect(result.productCount).toBe(100);
    expect(result.productCountIsLowerBound).toBe(true);
  });

  it('queries every curated brand alias for a combined authority hub', async () => {
    mockRange.mockResolvedValue({ data: [], error: null });
    mockHydrate.mockResolvedValue([]);
    const { getCachedBrandAuthorityInventory } = await import(
      './get-cached-brand-authority-inventory'
    );

    await getCachedBrandAuthorityInventory('merchant-1', 'smartphones', {
      brandAliases: ['Redmi'],
      brandKey: 'xiaomi',
      brandQueryValue: 'Xiaomi',
      categorySlug: 'smartphones',
      displayName: 'Xiaomi and Redmi',
      minimumProducts: 5,
    });

    expect(query.or).toHaveBeenCalledTimes(1);
    expect(query.or).toHaveBeenCalledWith(
      'and(is_parent.eq.true,brand.ilike.Xiaomi),and(parent_product_id.is.null,brand.ilike.Xiaomi),and(is_parent.eq.true,brand.ilike.Redmi),and(parent_product_id.is.null,brand.ilike.Redmi)'
    );
  });
});

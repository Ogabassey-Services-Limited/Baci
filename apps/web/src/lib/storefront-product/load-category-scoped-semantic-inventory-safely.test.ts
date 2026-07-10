import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedCategoryScopedSemanticInventory } from './get-cached-category-scoped-semantic-inventory';
import { loadCategoryScopedSemanticInventorySafely } from './load-category-scoped-semantic-inventory-safely';

vi.mock('./get-cached-category-scoped-semantic-inventory', () => ({
  getCachedCategoryScopedSemanticInventory: vi.fn(),
}));

const mockedInventory = vi.mocked(getCachedCategoryScopedSemanticInventory);

describe('loadCategoryScopedSemanticInventorySafely', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the scoped inventory on success', async () => {
    const inventory = {
      isCollection: false,
      categoryName: 'Laptops',
      products: [
        {
          slug: 'macbook-pro',
          name: 'MacBook Pro',
          price: 4_500_000,
          category_slug: 'laptops',
        },
      ],
    };
    mockedInventory.mockResolvedValue(inventory);

    const result = await loadCategoryScopedSemanticInventorySafely({
      merchantId: 'merchant-1',
      categorySlug: 'laptops',
      storeSlug: 'ogabassey',
      warningMessage: 'boom',
    });

    expect(result).toBe(inventory);
    expect(mockedInventory).toHaveBeenCalledWith(
      'merchant-1',
      'laptops',
      'ogabassey'
    );
  });

  it('degrades to an empty pool and warns on a transient failure', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mockedInventory.mockRejectedValue(new Error('timeout'));

    const result = await loadCategoryScopedSemanticInventorySafely({
      merchantId: 'merchant-1',
      categorySlug: 'laptops',
      storeSlug: 'ogabassey',
      warningMessage: 'inventory failed',
    });

    expect(result).toEqual({
      isCollection: false,
      categoryName: 'laptops',
      products: [],
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'inventory failed',
      expect.objectContaining({
        categorySlug: 'laptops',
        merchantId: 'merchant-1',
      })
    );
    warnSpy.mockRestore();
  });
});

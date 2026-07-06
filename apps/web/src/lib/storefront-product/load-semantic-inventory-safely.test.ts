import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedProductSemanticInventory } from './get-cached-product-semantic-inventory';
import { loadSemanticInventorySafely } from './load-semantic-inventory-safely';

vi.mock('./get-cached-product-semantic-inventory', () => ({
  getCachedProductSemanticInventory: vi.fn(),
}));

const mockedInventory = vi.mocked(getCachedProductSemanticInventory);

describe('loadSemanticInventorySafely', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns semantic inventory when loading succeeds', async () => {
    mockedInventory.mockResolvedValueOnce([
      {
        slug: 'xiaomi-13t',
        name: 'Xiaomi 13T',
        price: 450_000,
        category_slug: 'smartphones',
      },
    ]);

    await expect(
      loadSemanticInventorySafely({
        categorySlug: 'smartphones',
        merchantId: 'merchant-1',
        warningMessage: 'inventory failed',
      })
    ).resolves.toEqual([
      expect.objectContaining({
        slug: 'xiaomi-13t',
      }),
    ]);
  });

  it('logs and returns an empty inventory when loading fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Suppress expected warning noise for this server-side fallback path.
    });
    mockedInventory.mockRejectedValueOnce(new Error('inventory timeout'));

    await expect(
      loadSemanticInventorySafely({
        categorySlug: 'smartphones',
        merchantId: 'merchant-1',
        warningMessage: 'inventory failed',
      })
    ).resolves.toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      'inventory failed',
      expect.objectContaining({
        categorySlug: 'smartphones',
        merchantId: 'merchant-1',
      })
    );

    warnSpy.mockRestore();
  });
});

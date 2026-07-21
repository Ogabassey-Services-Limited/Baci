import { describe, expect, it, vi } from 'vitest';

const mockHydrate = vi.fn();
const mockRange = vi.fn();
const query = Object.fromEntries(
  ['select', 'eq', 'or', 'ilike', 'order'].map((name) => [name, vi.fn()])
) as Record<string, ReturnType<typeof vi.fn>>;
for (const method of Object.values(query))
  method.mockReturnValue({ ...query, range: mockRange });
vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/cached-data', () => ({
  getPublicSupabaseClient: () => ({
    from: () => ({ ...query, range: mockRange }),
  }),
  hydrateAndSanitizeProducts: (...args: unknown[]) => mockHydrate(...args),
}));

describe('getCachedBrandAuthorityInventory', () => {
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
});

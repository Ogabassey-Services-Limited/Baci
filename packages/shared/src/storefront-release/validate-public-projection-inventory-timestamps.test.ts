import { describe, expect, it } from 'vitest';
import { validatePublicProjectionInventoryTimestamps } from './validate-public-projection-inventory-timestamps';

function issuesFor(
  categories: readonly { id: string; slug: string }[],
  products: Parameters<typeof validatePublicProjectionInventoryTimestamps>[1]
) {
  const issues: Array<{ path?: PropertyKey[]; message?: string }> = [];
  validatePublicProjectionInventoryTimestamps(categories, products, {
    addIssue(issue: { path?: PropertyKey[]; message?: string }) {
      issues.push(issue);
    },
  } as Parameters<typeof validatePublicProjectionInventoryTimestamps>[2]);
  return issues;
}

describe('validatePublicProjectionInventoryTimestamps', () => {
  it('rejects a truncated compare window without createdAt metadata', () => {
    const products = Array.from({ length: 601 }, (_, index) => ({
      available: true,
      categoryIds: ['category-1'],
      createdAt: index === 600 ? undefined : '2026-08-31T00:00:00Z',
    }));

    expect(
      issuesFor([{ id: 'category-1', slug: 'smartphones' }], products)
    ).toEqual([
      expect.objectContaining({
        message:
          'Created timestamps are required for truncated compare inventory',
        path: ['products', 600, 'createdAt'],
      }),
    ]);
  });

  it('rejects a truncated brand window without updatedAt metadata', () => {
    const products = Array.from({ length: 49 }, (_, index) => ({
      available: true,
      brand: 'Samsung',
      categoryIds: ['category-1'],
      updatedAt: index === 48 ? undefined : '2026-08-31T00:00:00Z',
    }));

    expect(
      issuesFor([{ id: 'category-1', slug: 'smartphones' }], products)
    ).toEqual([
      expect.objectContaining({
        message:
          'Updated timestamps are required for truncated brand inventory',
        path: ['products', 48, 'updatedAt'],
      }),
    ]);
  });
});

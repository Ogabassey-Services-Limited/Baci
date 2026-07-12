import { describe, expect, it } from 'vitest';
import {
  type BulkUpdateChange,
  groupBulkUpdateChanges,
} from './bulk-update-change-groups';

function updateChange(
  productId: string | undefined,
  name?: string
): BulkUpdateChange {
  return {
    type: 'update',
    productId,
    newPrice: 100,
    details: { name, price: 100 },
  };
}

function newChange(name: string): BulkUpdateChange {
  return {
    type: 'new',
    details: { name, price: 100 },
  };
}

describe('groupBulkUpdateChanges', () => {
  it('groups differently cased UUIDs as one product', () => {
    const first = updateChange('A0000000-0000-4000-8000-000000000000');
    const second = updateChange('a0000000-0000-4000-8000-000000000000');

    expect(groupBulkUpdateChanges([first, second])).toEqual([[first, second]]);
  });

  it('serializes name changes that can generate colliding slugs', () => {
    const first = updateChange('product-1', 'Shared Slug');
    const second = updateChange('product-2', 'Shared Slug');

    expect(groupBulkUpdateChanges([first, second])).toEqual([[first, second]]);
  });

  it('keeps other changes for slug-sensitive products in the same group', () => {
    const rename = updateChange('product-1', 'Shared Slug');
    const priceOnly = updateChange('product-1');
    const created = newChange('Shared Slug');

    expect(groupBulkUpdateChanges([rename, priceOnly, created])).toEqual([
      [rename, priceOnly, created],
    ]);
  });

  it('keeps unrelated price-only updates concurrent', () => {
    const first = updateChange('product-1');
    const second = updateChange('product-2');

    expect(groupBulkUpdateChanges([first, second])).toEqual([
      [first],
      [second],
    ]);
  });

  it('serializes the batch when an existing target is ambiguous', () => {
    const ambiguous = updateChange(undefined);
    const independent = updateChange('product-2');

    expect(groupBulkUpdateChanges([ambiguous, independent])).toEqual([
      [ambiguous, independent],
    ]);
  });
});

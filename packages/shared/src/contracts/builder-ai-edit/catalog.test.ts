import { describe, expect, it } from 'vitest';
import { insertableComponentSchema, productGridPatchSchema } from './catalog';

describe('builder AI edit ProductGrid patch', () => {
  it('accepts only the bounded ProductGrid editable surface', () => {
    expect(
      productGridPatchSchema.safeParse({
        columns: 4,
        componentType: 'ProductGrid',
        limit: 24,
        showFilters: true,
        sortBy: 'name',
        title: 'New arrivals',
      }).success
    ).toBe(true);
    expect(
      productGridPatchSchema.safeParse({
        category: 'electronics',
        componentType: 'ProductGrid',
      }).success
    ).toBe(false);
  });

  it('keeps ProductGrid in the complete safe insertion union', () => {
    expect(
      insertableComponentSchema.safeParse({
        componentType: 'ProductGrid',
        title: 'Featured products',
      }).success
    ).toBe(true);
  });
});

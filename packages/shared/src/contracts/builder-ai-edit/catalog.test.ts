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
        title: 'New arrivals',
      }).success
    ).toBe(true);
    expect(
      productGridPatchSchema.safeParse({
        componentType: 'ProductGrid',
        sortBy: 'name',
      }).success
    ).toBe(false);
    expect(
      productGridPatchSchema.safeParse({
        category: 'electronics',
        componentType: 'ProductGrid',
      }).success
    ).toBe(false);
  });

  it('keeps ProductGrid in the complete safe insertion union', () => {
    // Arrange
    const explicit = {
      componentType: 'ProductGrid',
      title: 'Featured products',
    };
    const defaultOnly = { componentType: 'ProductGrid' };
    const invalid = { columns: 5, componentType: 'ProductGrid' };

    // Act
    const explicitResult = insertableComponentSchema.safeParse(explicit);
    const defaultResult = insertableComponentSchema.safeParse(defaultOnly);
    const invalidResult = insertableComponentSchema.safeParse(invalid);

    // Assert
    expect(explicitResult.success).toBe(true);
    expect(defaultResult.success).toBe(true);
    expect(invalidResult.success).toBe(false);
  });

  it('rejects the unsupported one-column product grid layout', () => {
    expect(
      productGridPatchSchema.safeParse({
        columns: 1,
        componentType: 'ProductGrid',
      }).success
    ).toBe(false);
  });
});

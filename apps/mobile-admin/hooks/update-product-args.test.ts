import { describe, expect, it } from 'vitest';
import type { ProductFormValues } from '@/lib/validators/product';
import { buildUpdateProductArgs } from './update-product-args';

const updates = { name: 'iPhone 15' } as unknown as ProductFormValues;

describe('buildUpdateProductArgs', () => {
  it('injects the merchant id and passes through the previous-category hints', () => {
    expect(
      buildUpdateProductArgs('merchant-1', {
        id: 'prod-1',
        updates,
        previousCategory: 'Smartphones',
        previousCategoryId: 'cat-old',
      })
    ).toEqual({
      id: 'prod-1',
      merchantId: 'merchant-1',
      updates,
      previousCategory: 'Smartphones',
      previousCategoryId: 'cat-old',
    });
  });

  it('leaves the previous-category hints undefined when absent', () => {
    expect(
      buildUpdateProductArgs('merchant-1', { id: 'prod-1', updates })
    ).toEqual({
      id: 'prod-1',
      merchantId: 'merchant-1',
      updates,
      previousCategory: undefined,
      previousCategoryId: undefined,
    });
  });
});

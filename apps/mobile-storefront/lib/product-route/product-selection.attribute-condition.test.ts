import { resolveDefaultVariantSelection } from '@baci/shared/lib';
import { describe, expect, it } from '@jest/globals';
import { computeProductSelectionState } from '@/lib/product-route/product-selection';
import type { Product } from '@/types/product';
import { variantProduct } from './product-detail-screen.fixtures';

describe('product selection attribute-backed conditions', () => {
  it('keeps a selected condition attribute as the effective condition', () => {
    const attributeConditionProduct: Product = {
      ...variantProduct,
      condition: 'new',
      variant_attributes: {
        condition: ['used', 'open_box'],
        storage: ['128GB', '256GB'],
      },
      variants: [
        {
          id: 'used-128',
          name: '128GB Used',
          price: 500_000,
          stock_quantity: 3,
          attributes: { condition: 'used', storage: '128GB' },
        },
        {
          id: 'open-box-256',
          name: '256GB Open Box',
          price: 650_000,
          stock_quantity: 4,
          attributes: { condition: 'open_box', storage: '256GB' },
        },
      ],
    };

    const result = computeProductSelectionState({
      defaultVariantSelection: resolveDefaultVariantSelection(
        attributeConditionProduct
      ),
      product: attributeConditionProduct,
      routeCondition: null,
      routeSelectionAttributes: {},
      routeVariantId: null,
      selectedAttributes: { condition: 'open_box' },
      selectedColor: null,
      selectedCondition: null,
      selectedStorage: null,
      selectedVariant: null,
    });

    expect(result.usesVariantConditions).toBe(false);
    expect(result.currentVariantDisplaySelection?.variant.id).toBe(
      'open-box-256'
    );
    expect(result.currentVariantSelection?.variant.id).toBe('open-box-256');
    expect(result.effectiveSelectedAttributes.condition).toBe('open_box');
    expect(result.effectiveSelectedCondition).toBe('open_box');
  });
});

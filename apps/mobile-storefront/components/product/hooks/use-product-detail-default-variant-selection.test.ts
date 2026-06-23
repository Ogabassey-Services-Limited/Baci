import { describe, expect, it } from '@jest/globals';
import { baseProduct } from '@/lib/product-route/product-detail-screen.fixtures';
import type { Product } from '@/types/product';
import { resolveProductDetailDefaultVariantSelection } from './use-product-detail-default-variant-selection';

describe('resolveProductDetailDefaultVariantSelection', () => {
  it('returns null before product data loads', () => {
    expect(resolveProductDetailDefaultVariantSelection(null)).toBeNull();
  });

  it('prefers the lowest-priced buyable variant for product detail pages', () => {
    const product: Product = {
      ...baseProduct,
      has_variants: true,
      variant_attributes: { storage: ['128GB'] },
      variants: [
        {
          id: 'used-128',
          name: '128GB Used',
          condition: 'used',
          price: 750_000,
          price_override: 750_000,
          stock_quantity: 2,
          attributes: { storage: '128GB' },
        },
        {
          id: 'open-box-128',
          name: '128GB Open Box',
          condition: 'open_box',
          price: 650_000,
          price_override: 650_000,
          stock_quantity: 2,
          attributes: { storage: '128GB' },
        },
      ],
    };

    expect(resolveProductDetailDefaultVariantSelection(product)?.variant.id).toBe(
      'open-box-128'
    );
  });
});

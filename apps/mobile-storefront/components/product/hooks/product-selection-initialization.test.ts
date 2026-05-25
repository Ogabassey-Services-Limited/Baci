import { describe, expect, it } from '@jest/globals';
import { variantProduct } from '@/lib/product-route/product-detail-screen.fixtures';
import type { Product } from '@/types/product';
import {
  getFallbackVariantSelections,
  getFirstImageIndexForColor,
  getSelectionSyncSignature,
} from './product-selection-initialization';

describe('product selection initialization', () => {
  it('seeds shopper-visible fallback axes while excluding internal variant axes', () => {
    const product: Product = {
      ...variantProduct,
      color_images: {
        Gold: ['https://cdn.example.com/gold.jpg'],
      },
      variant_attributes: {
        color: ['Black'],
        connectivity: ['WiFi'],
        ram: ['8GB'],
        storage: ['128GB'],
      },
    };

    expect(getFallbackVariantSelections(product)).toEqual({
      attributes: {
        connectivity: 'WiFi',
        ram: '8GB',
      },
      color: 'Gold',
      storage: '128GB',
    });
  });

  it('uses the first mapped color image when it is available in the gallery', () => {
    expect(
      getFirstImageIndexForColor({
        color: ' Gold ',
        colorImages: {
          Gold: ['https://cdn.example.com/gold.jpg'],
        },
        images: [
          'https://cdn.example.com/black.jpg',
          'https://cdn.example.com/gold.jpg',
        ],
      })
    ).toBe(1);

    expect(
      getFirstImageIndexForColor({
        color: 'Silver',
        colorImages: {
          Silver: ['https://cdn.example.com/silver.jpg'],
        },
        images: ['https://cdn.example.com/black.jpg'],
      })
    ).toBe(0);
  });

  it('changes the sync signature when purchasable variant inventory changes', () => {
    const initialSignature = getSelectionSyncSignature(variantProduct);
    const updatedSignature = getSelectionSyncSignature({
      ...variantProduct,
      variants: variantProduct.variants?.map((variant, index) =>
        index === 0 ? { ...variant, stock_quantity: 0 } : variant
      ),
    });

    expect(initialSignature).not.toBe(updatedSignature);
    expect(getSelectionSyncSignature(null)).toBe('');
  });
});

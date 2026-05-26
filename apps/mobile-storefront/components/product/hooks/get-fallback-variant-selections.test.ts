import { describe, expect, it } from '@jest/globals';
import { variantProduct } from '@/lib/product-route/product-detail-screen.fixtures';
import type { Product } from '@/types/product';
import { getFallbackVariantSelections } from './get-fallback-variant-selections';

describe('getFallbackVariantSelections', () => {
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

  it('returns empty fallback selections when no product is loaded', () => {
    expect(getFallbackVariantSelections(null)).toEqual({
      attributes: {},
      color: null,
      storage: null,
    });
  });

  it('falls back to the first variant color when no color images are mapped', () => {
    const product: Product = {
      ...variantProduct,
      variants: variantProduct.variants?.map((variant, index) =>
        index === 0
          ? {
              ...variant,
              attributes: { ...variant.attributes, color: 'Silver' },
            }
          : variant
      ),
    };

    expect(getFallbackVariantSelections(product).color).toBe('Silver');
  });

  it('falls back to product color names when variants do not expose color', () => {
    expect(
      getFallbackVariantSelections({
        ...variantProduct,
        colors: ['Black'],
      }).color
    ).toBe('Black');

    expect(
      getFallbackVariantSelections({
        ...variantProduct,
        colors: [{ name: 'Graphite', value: '#383838' }],
        variant_attributes: undefined,
        variants: undefined,
      })
    ).toEqual({
      attributes: {},
      color: 'Graphite',
      storage: null,
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { Product as CartProduct, ProductVariant } from '@/lib/products';
import {
  getVariantAxesWithMultipleOptions,
  normalizeCriticalVariantAttributes,
  normalizeCriticalVariantProduct,
  pickInitialSelectedAttributes,
} from './critical-commerce-selection';

const baseProduct: CartProduct = {
  brand: 'Samsung',
  condition: 'used',
  description: 'Samsung Galaxy S24',
  gtin: '',
  id: 'product-1',
  image: 'https://cdn.ogabassey.com/base.avif',
  imageHint: 'Samsung Galaxy S24',
  imageLarge: 'https://cdn.ogabassey.com/base-large.avif',
  manage_stock: true,
  mpn: 'samsung-galaxy-s24',
  name: 'Samsung Galaxy S24',
  price: 680_000,
  status: 'active',
  stock: 4,
};

describe('critical commerce legacy colour aliases', () => {
  it('normalizes colour axes to the hidden color selection axis', () => {
    expect(
      normalizeCriticalVariantAttributes({
        Colour: ' Jade Green ',
        'Colour Hex': ' #A7C9A4 ',
        Storage: '128GB',
      })
    ).toEqual({
      color: 'Jade Green',
      color_hex: '#A7C9A4',
      storage: '128GB',
    });
  });

  it('normalizes variant rows before critical provider resolution', () => {
    const variants: ProductVariant[] = [
      {
        attributes: { Colour: 'Jade Green', Storage: '128GB' },
        id: 'variant-jade',
        merchant_id: 'merchant-1',
        product_id: 'product-1',
        stock_quantity: 2,
      },
      {
        attributes: { color: 'Onyx Black', storage: '128GB' },
        id: 'variant-black',
        merchant_id: 'merchant-1',
        product_id: 'product-1',
        stock_quantity: 3,
      },
    ];

    expect(
      normalizeCriticalVariantProduct({ ...baseProduct, variants }).variants?.[0]
        .attributes
    ).toEqual({
      color: 'Jade Green',
      storage: '128GB',
    });
    expect(getVariantAxesWithMultipleOptions(variants)).toEqual(['color']);
    expect(
      pickInitialSelectedAttributes({
        explicitAttributes: { Colour: 'Jade Green' },
        renderableVariantAxes: ['storage'],
        selection: null,
      })
    ).toEqual({ color: 'Jade Green' });
  });
});

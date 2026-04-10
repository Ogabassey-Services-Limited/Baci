import { describe, expect, it } from 'vitest';
import { buildStructuredVariantPickerItems } from '@/lib/product-picker-variant-rows';

describe('buildStructuredVariantPickerItems', () => {
  it('maps structured product variants into selectable picker rows', () => {
    const rows = buildStructuredVariantPickerItems({
      parentProduct: {
        condition: 'new',
        images: ['parent.jpg'],
        name: 'Redmi A5',
        price: 102977,
      },
      variants: [
        {
          attributes: { ram: '4GB', storage: '128GB' },
          id: 'variant-1',
          price_override: '120651.00',
          sku: 'XM-A5-4-128',
        },
      ],
    });

    expect(rows).toEqual([
      {
        condition: 'new',
        cost_price: null,
        has_variants: false,
        id: 'variant-1',
        images: ['parent.jpg'],
        name: 'Redmi A5 4GB / 128GB',
        parent_product_id: null,
        price: 120651,
        primary_image: null,
        sku: 'XM-A5-4-128',
        source: 'structured',
        stock_quantity: 0,
        variant_attributes: { ram: '4GB', storage: '128GB' },
      },
    ]);
  });

  it('prefers variant images and falls back to parent price when needed', () => {
    const rows = buildStructuredVariantPickerItems({
      parentProduct: {
        condition: 'open_box',
        images: ['parent.jpg'],
        name: 'iPhone 14 Pro',
        price: 800000,
      },
      variants: [
        {
          attributes: { storage: '256GB' },
          id: 'variant-2',
          images: ['variant.jpg'],
          price_override: null,
          sku: null,
        },
      ],
    });

    expect(rows[0]).toMatchObject({
      images: ['variant.jpg'],
      price: 800000,
    });
  });
});

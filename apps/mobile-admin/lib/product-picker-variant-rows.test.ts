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
        condition: null,
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

  it('prefers variant images and falls back to parent price without inheriting the parent condition', () => {
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
      condition: null,
      images: ['variant.jpg'],
      price: 800000,
    });
  });

  it('prefers the structured variant condition when it is present', () => {
    const rows = buildStructuredVariantPickerItems({
      parentProduct: {
        condition: 'new',
        images: ['parent.jpg'],
        name: 'iPad 11th Gen',
        price: 550000,
      },
      variants: [
        {
          attributes: { connectivity: 'WiFi', storage: '128GB' },
          condition: 'used',
          id: 'variant-3',
          price_override: '500000',
          sku: 'IPAD11-USED-128-WIFI',
        },
      ],
    });

    expect(rows[0]).toMatchObject({
      condition: 'used',
      price: 500000,
    });
  });

  it('normalizes variant attributes to JSON-safe values', () => {
    const rows = buildStructuredVariantPickerItems({
      parentProduct: {
        images: [],
        name: 'Galaxy S26',
        price: 900000,
      },
      variants: [
        {
          attributes: {
            color: 'Black',
            ignored: undefined,
            specs: { esim: true, storage: '512GB' },
          },
          id: 'variant-4',
        },
      ],
    });

    expect(rows[0]?.variant_attributes).toEqual({
      color: 'Black',
      specs: { esim: true, storage: '512GB' },
    });
  });

  it('normalizes legacy keyed attribute arrays into object attributes', () => {
    const rows = buildStructuredVariantPickerItems({
      parentProduct: {
        images: [],
        name: 'Galaxy S26',
        price: 900000,
      },
      variants: [
        {
          attributes: [
            { name: 'Colour', value: 'Silver' },
            { name: 'Storage', value: '1TB' },
            { label: 'Warranty label', name: 'Warranty', value: null },
          ],
          id: 'variant-legacy',
        },
      ],
    });

    expect(rows[0]?.variant_attributes).toEqual({
      Colour: 'Silver',
      Storage: '1TB',
      Warranty: null,
    });
  });

  it('preserves explicit null variant attribute values', () => {
    const rows = buildStructuredVariantPickerItems({
      parentProduct: {
        images: [],
        name: 'Galaxy S26',
        price: 900000,
      },
      variants: [
        {
          attributes: {
            color: null,
            ignored: undefined,
            storage: '512GB',
          },
          id: 'variant-5',
        },
      ],
    });

    expect(rows[0]?.variant_attributes).toEqual({
      color: null,
      storage: '512GB',
    });
  });

  it('drops non-finite numeric variant attribute values', () => {
    const rows = buildStructuredVariantPickerItems({
      parentProduct: {
        images: [],
        name: 'Galaxy S26',
        price: 900000,
      },
      variants: [
        {
          attributes: {
            finite: 512,
            infinity: Number.POSITIVE_INFINITY,
            nan: Number.NaN,
          },
          id: 'variant-6',
        },
      ],
    });

    expect(rows[0]?.variant_attributes).toEqual({
      finite: 512,
    });
  });
});

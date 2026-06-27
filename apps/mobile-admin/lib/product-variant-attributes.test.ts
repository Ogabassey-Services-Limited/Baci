import { describe, expect, it } from 'vitest';
import type { AdminProductVariant } from '@/lib/product-picker-variant-rows';
import {
  getOrderedGroupKeys,
  getVariantAttributeMap,
  getVariantAttributeEntries,
} from '@/lib/product-variant-attributes';

function variant(
  attributes: AdminProductVariant['variant_attributes'],
  overrides: Partial<AdminProductVariant> = {}
): AdminProductVariant {
  return {
    condition: 'new',
    cost_price: null,
    has_variants: false,
    id: 'variant-1',
    images: [],
    name: 'Phone',
    parent_product_id: 'product-1',
    price: 1000,
    primary_image: null,
    sku: null,
    source: 'structured',
    stock_quantity: 1,
    variant_attributes: attributes,
    ...overrides,
  };
}

describe('getVariantAttributeEntries', () => {
  it('flattens nested records and canonicalizes colour keys', () => {
    expect(
      getVariantAttributeEntries(
        variant({ specs: { colour: 'Silver', esim: true } })
      )
    ).toEqual([
      { key: 'condition', label: 'Condition', value: 'new' },
      { key: 'specs.color', label: 'Specs Color', value: 'Silver' },
      { key: 'specs.esim', label: 'Specs Esim', value: 'true' },
    ]);
  });

  it('extracts keyed array attributes and falls back through label/options', () => {
    expect(
      getVariantAttributeEntries(
        variant([
          { name: 'Colour', value: 'Silver' },
          { key: 'Storage', label: '512GB' },
          { param: 'Bundle', options: ['Charger', 'Case'] },
          { name: 'Ignored', value: null },
        ])
      )
    ).toEqual([
      { key: 'condition', label: 'Condition', value: 'new' },
      { key: 'color', label: 'Color', value: 'Silver' },
      { key: 'storage', label: 'Storage', value: '512GB' },
      { key: 'bundle', label: 'Bundle', value: 'Charger / Case' },
    ]);
  });

  it('uses variant condition only when attributes do not provide one', () => {
    expect(
      getVariantAttributeEntries(
        variant({ condition: 'refurbished', storage: '256GB' }, { condition: 'new' })
      )
    ).toEqual([
      { key: 'condition', label: 'Condition', value: 'refurbished' },
      { key: 'storage', label: 'Storage', value: '256GB' },
    ]);

    expect(getVariantAttributeEntries(variant({}, { condition: 'open_box' }))).toEqual(
      [{ key: 'condition', label: 'Condition', value: 'open box' }]
    );
  });

  it('drops invalid and empty attribute inputs', () => {
    expect(getVariantAttributeEntries(variant(null))).toEqual([
      { key: 'condition', label: 'Condition', value: 'new' },
    ]);
    expect(
      getVariantAttributeEntries(
        variant({
          empty: '',
          infinity: Number.POSITIVE_INFINITY,
          missing: null,
          nested: { ignored: null },
        })
      )
    ).toEqual([{ key: 'condition', label: 'Condition', value: 'new' }]);
  });

  it('builds an attribute map from normalized entries', () => {
    expect(
      getVariantAttributeMap(
        variant({ colour: 'Blue', specs: { esim: false, storage: '1TB' } })
      )
    ).toEqual({
      color: 'Blue',
      condition: 'new',
      'specs.esim': 'false',
      'specs.storage': '1TB',
    });
  });
});

describe('getOrderedGroupKeys', () => {
  it('keeps preferred shopping attributes before custom keys', () => {
    expect(getOrderedGroupKeys(['storage', 'foo', 'color', 'condition'])).toEqual(
      ['condition', 'color', 'storage', 'foo']
    );
  });
});

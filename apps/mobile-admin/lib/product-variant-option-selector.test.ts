import { describe, expect, it } from 'vitest';
import type {
  AdminProductVariant,
  VariantAttributes,
} from '@/lib/product-picker-variant-rows';
import {
  buildVariantOptionGroups,
  completeSingleValueSelection,
  resolveSelectedVariant,
} from '@/lib/product-variant-option-selector';

function variant(
  id: string,
  attributes: VariantAttributes,
  overrides: Partial<AdminProductVariant> = {}
): AdminProductVariant {
  return {
    condition: 'new',
    cost_price: null,
    has_variants: false,
    id,
    images: [],
    name: `Phone ${id}`,
    parent_product_id: 'product-1',
    price: 1000,
    primary_image: null,
    sku: id.toUpperCase(),
    source: 'structured',
    stock_quantity: 1,
    variant_attributes: attributes,
    ...overrides,
  };
}

describe('buildVariantOptionGroups', () => {
  const variants = [
    variant('variant-1', { color: 'Black', ram: '12GB', storage: '256GB' }),
    variant('variant-2', { color: 'Black', ram: '12GB', storage: '512GB' }),
    variant('variant-3', { color: 'Blue', ram: '12GB', storage: '512GB' }),
  ];

  it('builds product-first option groups from structured variant rows', () => {
    const groups = buildVariantOptionGroups(variants, {});

    expect(groups.map((group) => group.key)).toEqual([
      'condition',
      'ram',
      'color',
      'storage',
    ]);
    expect(groups.find((group) => group.key === 'color')?.values).toEqual([
      { available: true, label: 'Black', selected: false, value: 'Black' },
      { available: true, label: 'Blue', selected: false, value: 'Blue' },
    ]);
  });

  it('marks impossible option values unavailable after partial selection', () => {
    const groups = buildVariantOptionGroups(variants, {
      color: 'Blue',
    });

    expect(groups.find((group) => group.key === 'storage')?.values).toEqual([
      { available: false, label: '256GB', selected: false, value: '256GB' },
      { available: true, label: '512GB', selected: false, value: '512GB' },
    ]);
  });

  it('ignores stale selection keys when calculating availability', () => {
    const groups = buildVariantOptionGroups(variants, {
      color: 'Blue',
      discontinued_axis: 'stale',
    });

    expect(groups.find((group) => group.key === 'storage')?.values).toEqual([
      { available: false, label: '256GB', selected: false, value: '256GB' },
      { available: true, label: '512GB', selected: false, value: '512GB' },
    ]);
  });

  it('does not let sparse variants satisfy selected active attributes they lack', () => {
    const sparseVariants = [
      variant('variant-1', { color: 'Black', storage: '256GB' }),
      variant('variant-2', { color: 'Blue' }),
    ];
    const groups = buildVariantOptionGroups(sparseVariants, {
      storage: '256GB',
    });

    expect(groups.find((group) => group.key === 'color')?.values).toEqual([
      { available: true, label: 'Black', selected: false, value: 'Black' },
      { available: false, label: 'Blue', selected: false, value: 'Blue' },
    ]);
  });

  it('canonicalizes equivalent color and colour keys into one group', () => {
    const groups = buildVariantOptionGroups(
      [
        variant('variant-1', { color: 'Black', storage: '256GB' }),
        variant('variant-2', { colour: 'Blue', storage: '256GB' }),
      ],
      {}
    );

    expect(groups.find((group) => group.key === 'color')?.values).toEqual([
      { available: true, label: 'Black', selected: false, value: 'Black' },
      { available: true, label: 'Blue', selected: false, value: 'Blue' },
    ]);
  });

  it('builds groups from nested objects and boolean attribute values', () => {
    const groups = buildVariantOptionGroups(
      [
        variant('variant-1', {
          specs: { esim: true, storage: '512GB' },
        }),
        variant('variant-2', {
          specs: { esim: false, storage: '1TB' },
        }),
      ],
      {}
    );

    expect(groups.find((group) => group.key === 'specs.esim')?.values).toEqual(
      [
        { available: true, label: 'true', selected: false, value: 'true' },
        { available: true, label: 'false', selected: false, value: 'false' },
      ]
    );
    expect(
      groups.find((group) => group.key === 'specs.storage')?.values
    ).toEqual([
      { available: true, label: '512GB', selected: false, value: '512GB' },
      { available: true, label: '1TB', selected: false, value: '1TB' },
    ]);
  });

  it('prefills single available option groups', () => {
    expect(completeSingleValueSelection(variants, {})).toEqual({
      condition: 'new',
      ram: '12GB',
    });
  });
});

describe('resolveSelectedVariant', () => {
  const variants = [
    variant('variant-1', { color: 'Black', ram: '12GB', storage: '256GB' }),
    variant('variant-2', { color: 'Black', ram: '12GB', storage: '512GB' }),
  ];

  it('resolves the selected variant only when one full match exists', () => {
    expect(
      resolveSelectedVariant(variants, {
        color: 'Black',
        condition: 'new',
        ram: '12GB',
        stale_axis: 'ignored',
        storage: '512GB',
      })?.id
    ).toBe('variant-2');
  });

  it('returns null for incomplete or ambiguous selections', () => {
    expect(
      resolveSelectedVariant(variants, {
        color: 'Black',
        condition: 'new',
        ram: '12GB',
      })
    ).toBeNull();
  });

  it('does not resolve a sparse variant that lacks a selected active attribute', () => {
    expect(
      resolveSelectedVariant(
        [
          variant('variant-1', { color: 'Black', storage: '256GB' }),
          variant('variant-2', { color: 'Blue' }),
        ],
        {
          color: 'Blue',
          condition: 'new',
          storage: '256GB',
        }
      )
    ).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type {
  AdminProductVariant,
  VariantAttributes,
} from '@/lib/product-picker-variant-rows';
import {
  buildVariantOptionGroups,
  completeSingleValueSelection,
  resolveSelectedVariant,
  selectVariantOption,
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

    expect(groups.map((group) => group.key)).toEqual(['color', 'storage']);
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

  it('does not turn a sparse single-value attribute into a required selector', () => {
    const sparseVariants = [
      variant('variant-1', { color: 'Black', storage: '256GB' }),
      variant('variant-2', { color: 'Blue' }),
    ];
    const groups = buildVariantOptionGroups(sparseVariants, {});

    expect(groups.find((group) => group.key === 'color')?.values).toEqual([
      { available: true, label: 'Black', selected: false, value: 'Black' },
      { available: true, label: 'Blue', selected: false, value: 'Blue' },
    ]);
    expect(groups.find((group) => group.key === 'storage')).toBeUndefined();
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

  it('does not expose color hex metadata as a selectable option group', () => {
    const groups = buildVariantOptionGroups(
      [
        variant('variant-1', {
          color: 'Black',
          color_hex: '#000000',
          storage: '256GB',
        }),
        variant('variant-2', {
          colour: 'Silver',
          colour_hex: '#c0c0c0',
          storage: '512GB',
        }),
      ],
      {}
    );

    expect(groups.map((group) => group.key)).toEqual(['color', 'storage']);
  });

  it('sorts storage-style values by capacity instead of insertion order', () => {
    const groups = buildVariantOptionGroups(
      [
        variant('variant-1', { storage: '512GB' }),
        variant('variant-2', { storage: '128GB' }),
        variant('variant-3', { storage: '256GB' }),
      ],
      {}
    );

    expect(groups.find((group) => group.key === 'storage')?.values).toEqual([
      { available: true, label: '128GB', selected: false, value: '128GB' },
      { available: true, label: '256GB', selected: false, value: '256GB' },
      { available: true, label: '512GB', selected: false, value: '512GB' },
    ]);
  });

  it('sorts capacity values before trailing storage descriptors', () => {
    const groups = buildVariantOptionGroups(
      [
        variant('variant-1', { storage: '1TB SSD' }),
        variant('variant-2', { storage: '512GB SSD' }),
        variant('variant-3', { storage: '256GB SSD' }),
      ],
      {}
    );

    expect(groups.find((group) => group.key === 'storage')?.values).toEqual([
      {
        available: true,
        label: '256GB SSD',
        selected: false,
        value: '256GB SSD',
      },
      {
        available: true,
        label: '512GB SSD',
        selected: false,
        value: '512GB SSD',
      },
      { available: true, label: '1TB SSD', selected: false, value: '1TB SSD' },
    ]);
  });

  it('keeps SSD and HDD as distinct selectable storage options', () => {
    const groups = buildVariantOptionGroups(
      [
        variant('variant-ssd', { storage: '1TB SSD' }),
        variant('variant-hdd', { storage: '1TB HDD' }),
      ],
      {}
    );

    expect(groups.find((group) => group.key === 'storage')?.values).toEqual([
      { available: true, label: '1TB HDD', selected: false, value: '1TB HDD' },
      { available: true, label: '1TB SSD', selected: false, value: '1TB SSD' },
    ]);
  });

  it('sorts camelCase capacity keys by capacity', () => {
    const groups = buildVariantOptionGroups(
      [
        variant('variant-1', { storageCapacity: '512GB' }),
        variant('variant-2', { storageCapacity: '128GB' }),
        variant('variant-3', { storageCapacity: '1TB' }),
      ],
      {}
    );

    expect(groups.find((group) => group.key === 'storage')?.values).toEqual([
      { available: true, label: '128GB', selected: false, value: '128GB' },
      { available: true, label: '512GB', selected: false, value: '512GB' },
      { available: true, label: '1TB', selected: false, value: '1TB' },
    ]);
  });

  it('does not expose nested specification objects as purchase choices', () => {
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

    expect(groups).toEqual([]);
  });

  it('does not prefill fixed specifications as selections', () => {
    expect(completeSingleValueSelection(variants, {})).toEqual({});
  });

  it('keeps M16 R2 metadata out of the selectable matrix', () => {
    const declaration = {
      condition: ['used'],
      gpu: ['RTX 4070'],
      processor: ['Intel Ultra 7 155H', 'Intel Ultra 9 185H'],
      ram: ['16GB', '32GB'],
      storage: ['1TB'],
    };
    const groups = buildVariantOptionGroups(
      [
        variant(
          'used-16',
          {
            graphics: '8GB RTX 4070 Graphics',
            processor: 'Intel Ultra 7 155H',
            ram: '16GB RAM',
            storage: '1TB SSD',
          },
          { condition: 'used' }
        ),
        variant(
          'new-64',
          {
            camera: 'Webcam',
            graphics: '8GB NVIDIA GeForce RTX 4070 Graphics',
            keyboard: 'Backlit keyboard',
            model_number: 'DYMSR54',
            operating_system: 'Windows 11 Pro',
            processor: 'Intel Core Ultra 7 155H',
            ram: '64GB RAM',
            storage: '1TB SSD',
            wireless: 'WLAN and Bluetooth',
          },
          { condition: 'new' }
        ),
      ],
      {},
      { declaration }
    );

    expect(groups.map((group) => group.key)).toEqual(['condition', 'ram']);
  });

  it('drops incompatible earlier selections when a new option is chosen', () => {
    const next = selectVariantOption(
      variants,
      { color: 'Blue', storage: '512GB' },
      'storage',
      '256GB'
    );

    expect(next).toEqual({ storage: '256GB' });
  });

  it('clears an option when its selected value is chosen again', () => {
    const next = selectVariantOption(
      variants,
      { color: 'Blue', storage: '512GB' },
      'storage',
      '512GB'
    );

    expect(next).toEqual({ color: 'Blue', storage: '' });
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

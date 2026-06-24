import { describe, expect, it } from 'vitest';
import {
  getAvailableOptionsForAxis,
  getRenderableVariantAxes,
  getVariantAttributeOptions,
  mergeVariantAxisOptions,
  normalizeVariantAttributes,
} from '@/components/storefront/ogabassey/variant-attributes';

describe('variant attributes helpers', () => {
  it('normalizes production array-based variant attributes', () => {
    expect(
      normalizeVariantAttributes([
        { param: 'storage', options: ['128GB', '256GB', '512GB'] },
        { param: 'sim_type', options: ['Physical + eSIM', 'eSIM Only'] },
      ])
    ).toEqual({
      sim_type: ['Physical + eSIM', 'eSIM Only'],
      storage: ['128GB', '256GB', '512GB'],
    });
  });

  it('reads legacy object-map variant attributes case-insensitively', () => {
    expect(
      getVariantAttributeOptions(
        {
          Platform: ['PlayStation 5', 'Xbox'],
          Storage: ['1TB'],
        },
        'platform'
      )
    ).toEqual(['PlayStation 5', 'Xbox']);
  });

  it('merges denormalized options with variant rows', () => {
    const merged = mergeVariantAxisOptions(
      [
        {
          attributes: {
            color: 'Black',
            color_hex: '#000000',
            sim_type: 'Dual Nano SIM',
            storage: '128GB',
          },
        },
        {
          attributes: {
            color: 'Black',
            color_hex: '#000000',
            sim_type: 'eSIM Only',
            storage: '512GB',
          },
        },
      ],
      [{ param: 'storage', options: ['128GB', '256GB', '512GB'] }]
    );

    expect(merged.storage).toEqual(['128GB', '256GB', '512GB']);
    expect(merged.sim_type).toEqual(['Dual Nano SIM', 'eSIM Only']);
    expect(merged.color).toEqual(['Black']);
  });

  it('returns renderable variant axes filtering hidden axes', () => {
    expect(
      getRenderableVariantAxes(
        [
          {
            attributes: {
              color: 'Black',
              color_hex: '#000000',
              sim_type: 'Dual Nano SIM',
              storage: '128GB',
            },
          },
          {
            attributes: {
              color: 'White',
              color_hex: '#ffffff',
              sim_type: 'eSIM Only',
              storage: '512GB',
            },
          },
        ],
        [{ param: 'storage', options: ['128GB', '256GB', '512GB'] }]
      )
    ).toEqual(['storage', 'sim_type']);
  });

  describe('getAvailableOptionsForAxis', () => {
    const s22Variants = [
      { attributes: { ram: '8GB', storage: '128GB' } },
      { attributes: { ram: '12GB', storage: '256GB' } },
      { attributes: { ram: '12GB', storage: '512GB' } },
    ];

    it('returns all storage values when no selections are made', () => {
      expect(
        getAvailableOptionsForAxis('storage', s22Variants, {}),
      ).toEqual(['128GB', '256GB', '512GB']);
    });

    it('filters storage to valid pairs when 8GB RAM is selected', () => {
      expect(
        getAvailableOptionsForAxis('storage', s22Variants, { ram: '8GB' }),
      ).toEqual(['128GB']);
    });

    it('filters storage to valid pairs when 12GB RAM is selected', () => {
      expect(
        getAvailableOptionsForAxis('storage', s22Variants, { ram: '12GB' }),
      ).toEqual(['256GB', '512GB']);
    });

    it('filters RAM to valid pairs when storage is selected', () => {
      expect(
        getAvailableOptionsForAxis('ram', s22Variants, { storage: '128GB' }),
      ).toEqual(['8GB']);
      expect(
        getAvailableOptionsForAxis('ram', s22Variants, { storage: '256GB' }),
      ).toEqual(['12GB']);
    });

    it('ignores the queried axis in currentSelections (prevents self-filtering)', () => {
      // With ram=12GB, both 256GB and 512GB are reachable.
      // If storage=256GB were NOT ignored, only ['256GB'] would be returned.
      expect(
        getAvailableOptionsForAxis('storage', s22Variants, {
          ram: '12GB',
          storage: '256GB',
        }),
      ).toEqual(['256GB', '512GB']);
    });

    it('returns empty array when no variants match the current selections', () => {
      expect(
        getAvailableOptionsForAxis('storage', s22Variants, { ram: '999GB' }),
      ).toEqual([]);
    });

    it('returns empty array for null/undefined variants', () => {
      expect(getAvailableOptionsForAxis('storage', null, {})).toEqual([]);
      expect(getAvailableOptionsForAxis('storage', undefined, {})).toEqual([]);
    });

    it('works with three-axis variants (S24 Ultra sim_type)', () => {
      const s24Variants = [
        {
          attributes: { ram: '12GB', storage: '512GB', sim_type: 'Single' },
        },
        { attributes: { ram: '12GB', storage: '512GB', sim_type: 'Dual' } },
        { attributes: { ram: '12GB', storage: '1TB', sim_type: 'Single' } },
      ];

      expect(
        getAvailableOptionsForAxis('sim_type', s24Variants, {
          storage: '1TB',
        }),
      ).toEqual(['Single']);

      expect(
        getAvailableOptionsForAxis('sim_type', s24Variants, {
          storage: '512GB',
        }),
      ).toEqual(['Single', 'Dual']);
    });
  });

  it('handles empty variant rows and empty axis definitions', () => {
    expect(mergeVariantAxisOptions([], [])).toEqual({});
    expect(getRenderableVariantAxes([], [])).toEqual([]);
  });

  it('ignores variants without attributes when building axes', () => {
    expect(
      mergeVariantAxisOptions(
        [{}, { attributes: undefined }, { attributes: { storage: '128GB' } }],
        []
      )
    ).toEqual({
      storage: ['128GB'],
    });

    expect(
      getRenderableVariantAxes(
        [{}, { attributes: undefined }, { attributes: { storage: '128GB' } }],
        []
      )
    ).toEqual([]);
  });
});

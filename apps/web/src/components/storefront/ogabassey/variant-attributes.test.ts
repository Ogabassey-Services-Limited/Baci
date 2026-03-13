import { describe, expect, it } from 'vitest';
import {
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

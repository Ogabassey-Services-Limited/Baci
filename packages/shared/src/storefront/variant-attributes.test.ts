import { describe, expect, it } from 'vitest';
import {
  formatVariantAxisLabel,
  getRenderableVariantAxes,
  getVariantAttributeOptions,
  mergeVariantAxisOptions,
  normalizeVariantAttributes,
} from './variant-attributes';

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

  it('does not mutate cached source options when merging variant rows', () => {
    const source = {
      storage: ['128GB', '256GB'],
    };

    expect(getVariantAttributeOptions(source, 'storage')).toEqual([
      '128GB',
      '256GB',
    ]);

    expect(
      mergeVariantAxisOptions(
        [
          {
            attributes: {
              storage: '512GB',
            },
          },
        ],
        source
      ).storage
    ).toEqual(['128GB', '256GB', '512GB']);

    expect(getVariantAttributeOptions(source, 'storage')).toEqual([
      '128GB',
      '256GB',
    ]);
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

  it('formats human-readable axis labels', () => {
    expect(formatVariantAxisLabel('sim_type')).toBe('SIM Type');
    expect(formatVariantAxisLabel('battery_type')).toBe('Battery Type');
    expect(formatVariantAxisLabel('cpu')).toBe('CPU');
    expect(formatVariantAxisLabel('color')).toBe('Color');
    expect(formatVariantAxisLabel('__size__')).toBe('Size');
    expect(formatVariantAxisLabel('weight__type')).toBe('Weight Type');
  });
});

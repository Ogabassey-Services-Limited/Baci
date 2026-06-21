import { describe, expect, it } from 'vitest';
import {
  canonicalizeVariantAxis,
  getAvailableOptionsForAxis,
  getRenderableVariantAxes,
  getVariantAttributeOptions,
  mergeVariantAxisOptions,
  normalizeVariantAttributes,
} from './variant-attributes';

describe('storefront variant attribute helpers', () => {
  it('canonicalizes variant axis labels', () => {
    expect(canonicalizeVariantAxis(' SIM Type ')).toBe('sim_type');
    expect(canonicalizeVariantAxis('Color-Hex')).toBe('color_hex');
    expect(canonicalizeVariantAxis('')).toBe('');
  });

  it('normalizes array, object, null, undefined, and malformed entries', () => {
    expect(
      normalizeVariantAttributes([
        { param: 'Storage', options: ['128GB', '256GB', '128GB', ' '] },
        { param: 'SIM Type', options: 'eSIM' },
        { param: '', options: ['ignored'] },
        { param: 'RAM', options: [8, '12GB'] },
        null as never,
        { options: ['missing param'] } as never,
      ])
    ).toEqual({
      ram: ['12GB'],
      sim_type: ['eSIM'],
      storage: ['128GB', '256GB'],
    });

    expect(
      normalizeVariantAttributes({
        Platform: ['PlayStation 5', 'Xbox'],
        Storage: '1TB',
        Color: null,
      })
    ).toEqual({
      platform: ['PlayStation 5', 'Xbox'],
      storage: ['1TB'],
    });

    expect(normalizeVariantAttributes(null)).toEqual({});
    expect(normalizeVariantAttributes(undefined)).toEqual({});
  });

  it('reads a single axis by canonical key', () => {
    expect(
      getVariantAttributeOptions(
        { 'SIM Type': ['Physical + eSIM', 'eSIM Only'] },
        'sim-type'
      )
    ).toEqual(['Physical + eSIM', 'eSIM Only']);
  });

  it('merges declared axis options with variant rows', () => {
    expect(
      mergeVariantAxisOptions(
        [
          {
            attributes: { Storage: '128GB', RAM: '8GB', color: 'Black' },
            condition: 'refurbished',
          },
          {
            attributes: { Storage: '512GB', RAM: '12GB', color: 'Black' },
            condition: 'new',
          },
          {},
        ],
        [{ param: 'storage', options: ['128GB', '256GB'] }]
      )
    ).toEqual({
      color: ['Black'],
      condition: ['open_box', 'new'],
      ram: ['8GB', '12GB'],
      storage: ['128GB', '256GB', '512GB'],
    });

    expect(mergeVariantAxisOptions(null, null)).toEqual({});
  });

  it('filters available options for the requested axis by other selections', () => {
    const variants = [
      {
        attributes: { RAM: '8GB', Storage: '128GB', 'SIM Type': 'Single' },
        condition: 'uk_used',
      },
      {
        attributes: { RAM: '12GB', Storage: '256GB', 'SIM Type': 'Single' },
        condition: 'new',
      },
      {
        attributes: { RAM: '12GB', Storage: '512GB', 'SIM Type': 'Dual' },
        condition: 'new',
      },
    ];

    expect(getAvailableOptionsForAxis('storage', variants, {})).toEqual([
      '128GB',
      '256GB',
      '512GB',
    ]);
    expect(
      getAvailableOptionsForAxis('storage', variants, { ram: '12GB' })
    ).toEqual(['256GB', '512GB']);
    expect(
      getAvailableOptionsForAxis('storage', variants, {
        RAM: '12GB',
        storage: '256GB',
      })
    ).toEqual(['256GB', '512GB']);
    expect(
      getAvailableOptionsForAxis('ram', variants, { storage: '128GB' })
    ).toEqual(['8GB']);
    expect(
      getAvailableOptionsForAxis('storage', variants, { ram: '16GB' })
    ).toEqual([]);
    expect(
      getAvailableOptionsForAxis('condition', variants, { ram: '12GB' })
    ).toEqual(['new']);
    expect(
      getAvailableOptionsForAxis('storage', variants, { condition: 'used' })
    ).toEqual(['128GB']);
    expect(
      getAvailableOptionsForAxis('condition', variants, { storage: '128GB' })
    ).toEqual(['used']);
    expect(getAvailableOptionsForAxis('storage', null, {})).toEqual([]);
  });

  it('returns renderable axes by priority while filtering non-renderable axes', () => {
    expect(
      getRenderableVariantAxes(
        [
          {
            attributes: {
              color: 'Black',
              connectivity: 'WiFi',
              condition: 'new',
              platform: 'PS5',
              RAM: '8GB',
              Storage: '128GB',
            },
          },
          {
            attributes: {
              color: 'White',
              connectivity: 'WiFi',
              condition: 'new',
              platform: 'Xbox',
              RAM: '12GB',
              Storage: '512GB',
            },
          },
        ],
        [{ param: 'sim type', options: ['Single', 'Dual'] }]
      )
    ).toEqual(['storage', 'ram', 'sim_type', 'connectivity', 'platform']);

    expect(getRenderableVariantAxes([], [])).toEqual([]);
  });

  it('renders condition only when multiple top-level SKU conditions exist', () => {
    expect(
      getRenderableVariantAxes(
        [
          { attributes: { Storage: '128GB' }, condition: 'used' },
          { attributes: { Storage: '256GB' }, condition: 'new' },
        ],
        []
      )
    ).toEqual(['condition', 'storage']);

    expect(
      getRenderableVariantAxes(
        [
          { attributes: { Storage: '128GB' }, condition: 'used' },
          { attributes: { Storage: '256GB' }, condition: 'used' },
        ],
        []
      )
    ).toEqual(['storage']);

    expect(
      getRenderableVariantAxes(
        [
          { attributes: { Storage: '128GB' } },
          { attributes: { Storage: '256GB' } },
        ],
        []
      )
    ).toEqual(['storage']);
  });
});

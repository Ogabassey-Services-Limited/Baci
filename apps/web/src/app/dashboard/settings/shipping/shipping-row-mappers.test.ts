import { describe, expect, it } from 'vitest';
import {
  groupLocationsByZone,
  mapRateRow,
  mapRateRows,
  mapZoneRows,
} from './shipping-row-mappers';

describe('groupLocationsByZone', () => {
  it('groups multiple locations under the same zone', () => {
    const result = groupLocationsByZone([
      { zone_id: 'z-1', country_code: 'NG', subdivision_code: 'NG-LA' },
      { zone_id: 'z-1', country_code: 'NG', subdivision_code: null },
      { zone_id: 'z-2', country_code: 'AE', subdivision_code: null },
    ]);

    expect(result.get('z-1')).toEqual([
      { countryCode: 'NG', subdivisionCode: 'NG-LA' },
      { countryCode: 'NG', subdivisionCode: null },
    ]);
    expect(result.get('z-2')).toEqual([
      { countryCode: 'AE', subdivisionCode: null },
    ]);
  });

  it('returns an empty map for no rows', () => {
    expect(groupLocationsByZone([]).size).toBe(0);
  });
});

describe('mapZoneRows', () => {
  it('attaches grouped locations to each zone, defaulting to empty', () => {
    const result = mapZoneRows(
      [
        { id: 'z-1', name: 'Lagos', is_rest_of_world: false, active: true },
        {
          id: 'z-row',
          name: 'Everywhere else',
          is_rest_of_world: true,
          active: true,
        },
      ],
      [{ zone_id: 'z-1', country_code: 'NG', subdivision_code: 'NG-LA' }]
    );

    expect(result).toEqual([
      {
        id: 'z-1',
        name: 'Lagos',
        isRestOfWorld: false,
        active: true,
        locations: [{ countryCode: 'NG', subdivisionCode: 'NG-LA' }],
      },
      {
        id: 'z-row',
        name: 'Everywhere else',
        isRestOfWorld: true,
        active: true,
        locations: [],
      },
    ]);
  });
});

describe('mapRateRow', () => {
  const baseRow = {
    id: 'r-1',
    zone_id: 'z-1',
    name: 'Standard',
    kind: 'ship',
    currency: 'NGN',
    base_amount: 1500,
    condition_type: 'always',
    min_subtotal: null,
    max_subtotal: null,
    free_over_amount: null,
    delivery_min_days: null,
    delivery_max_days: null,
    pickup_address: null,
    sort_order: 0,
    active: true,
  };

  it('maps a flat always-on rate', () => {
    expect(mapRateRow(baseRow)).toEqual({
      id: 'r-1',
      zoneId: 'z-1',
      name: 'Standard',
      kind: 'ship',
      currency: 'NGN',
      baseAmount: 1500,
      conditionType: 'always',
      minSubtotal: null,
      maxSubtotal: null,
      freeOverAmount: null,
      deliveryMinDays: null,
      deliveryMaxDays: null,
      pickupAddress: null,
      sortOrder: 0,
      active: true,
    });
  });

  it('coerces numeric-string amounts (Postgres numeric columns)', () => {
    const result = mapRateRow({
      ...baseRow,
      base_amount: '2500.00' as unknown as number,
      min_subtotal: '0' as unknown as number,
      max_subtotal: '50000' as unknown as number,
    });

    expect(result.baseAmount).toBe(2500);
    expect(result.minSubtotal).toBe(0);
    expect(result.maxSubtotal).toBe(50_000);
  });

  it('keeps a valid pickup_address object', () => {
    const result = mapRateRow({
      ...baseRow,
      kind: 'pickup',
      pickup_address: { label: 'Main Store', address: '12 Adeola Odeku' },
    });

    expect(result.pickupAddress).toEqual({
      label: 'Main Store',
      address: '12 Adeola Odeku',
    });
  });

  it('drops a malformed pickup_address instead of throwing', () => {
    const result = mapRateRow({
      ...baseRow,
      pickup_address: 'not an object',
    });

    expect(result.pickupAddress).toBeNull();
  });

  it('maps a list of rows', () => {
    expect(mapRateRows([baseRow, { ...baseRow, id: 'r-2' }])).toHaveLength(2);
  });
});

import { describe, expect, it } from 'vitest';
import { matchShippingZone } from './match-zone';
import type {
  MerchantShippingZone,
  MerchantShippingZoneLocation,
} from './types';

function zone(
  id: string,
  overrides: Partial<MerchantShippingZone> = {}
): MerchantShippingZone {
  return {
    id,
    name: id,
    isRestOfWorld: false,
    active: true,
    ...overrides,
  };
}

function location(
  zoneId: string,
  countryCode: string,
  subdivisionCode: string | null
): MerchantShippingZoneLocation {
  return { zoneId, countryCode, subdivisionCode };
}

const lagosZone = zone('z-lagos');
const nigeriaZone = zone('z-ng');
const restOfWorldZone = zone('z-row', { isRestOfWorld: true });

const zones = [lagosZone, nigeriaZone, restOfWorldZone];
const locations = [
  location('z-lagos', 'NG', 'NG-LA'),
  location('z-ng', 'NG', null),
];

describe('matchShippingZone', () => {
  it('prefers a subdivision match over a country match (specificity 2 > 1)', () => {
    const result = matchShippingZone(zones, locations, {
      countryCode: 'NG',
      subdivisionCode: 'NG-LA',
    });

    expect(result).toBe(lagosZone);
  });

  it('prefers a country match over rest-of-world (specificity 1 > 0)', () => {
    const result = matchShippingZone(zones, locations, {
      countryCode: 'NG',
      subdivisionCode: 'NG-KN',
    });

    expect(result).toBe(nigeriaZone);
  });

  it('falls back to the rest-of-world zone for uncovered destinations', () => {
    const result = matchShippingZone(zones, locations, {
      countryCode: 'US',
    });

    expect(result).toBe(restOfWorldZone);
  });

  it('still matches at country level when no subdivision is provided', () => {
    const result = matchShippingZone(zones, locations, {
      countryCode: 'NG',
    });

    expect(result).toBe(nigeriaZone);
  });

  it('normalizes case for country and subdivision codes', () => {
    const result = matchShippingZone(zones, locations, {
      countryCode: 'ng',
      subdivisionCode: 'ng-la',
    });

    expect(result).toBe(lagosZone);
  });

  it('returns null when there are no zones', () => {
    expect(
      matchShippingZone([], [], { countryCode: 'NG', subdivisionCode: 'NG-LA' })
    ).toBeNull();
  });

  it('returns null when nothing covers the destination and there is no fallback', () => {
    const result = matchShippingZone([lagosZone], locations, {
      countryCode: 'US',
    });

    expect(result).toBeNull();
  });

  it('ignores inactive zones', () => {
    const inactiveLagos = zone('z-lagos', { active: false });

    const result = matchShippingZone([inactiveLagos, nigeriaZone], locations, {
      countryCode: 'NG',
      subdivisionCode: 'NG-LA',
    });

    expect(result).toBe(nigeriaZone);
  });

  it('breaks ties deterministically by input order (first wins)', () => {
    const firstNg = zone('z-ng-a');
    const secondNg = zone('z-ng-b');
    const tieLocations = [
      location('z-ng-a', 'NG', null),
      location('z-ng-b', 'NG', null),
    ];

    const result = matchShippingZone([firstNg, secondNg], tieLocations, {
      countryCode: 'NG',
    });

    expect(result).toBe(firstNg);
  });
});

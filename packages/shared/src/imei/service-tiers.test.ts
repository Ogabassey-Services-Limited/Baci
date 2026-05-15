import { describe, expect, it } from 'vitest';
import {
  ALL_IMEI_SERVICE_TIERS,
  getVisibleImeiServiceTierKeys,
  IMEI_SERVICE_TIERS,
  imeiTierMatchesBrand,
  isImeiServiceTierKey,
  PRIMARY_IMEI_SERVICE_TIERS,
} from './service-tiers';

describe('IMEI service tiers', () => {
  it('keeps Full Report pricing and provider id in the shared catalog', () => {
    expect(IMEI_SERVICE_TIERS.full).toMatchObject({
      name: 'Full Report',
      price: 1500,
      providerServiceId: '61',
      recommended: true,
    });
  });

  it('exposes only primary service cards before expansion', () => {
    expect(getVisibleImeiServiceTierKeys('all', false)).toEqual([
      'full',
      'activation',
      'blacklist',
      'carrier',
    ]);
  });

  it('filters brand-scoped services for expanded Apple checks', () => {
    const appleTiers = getVisibleImeiServiceTierKeys('apple', true);

    expect(appleTiers).toContain('activation');
    expect(appleTiers).toContain('carrier');
    expect(appleTiers).not.toContain('samsung');
  });

  it('keeps every tier executable and priced', () => {
    for (const tierKey of ALL_IMEI_SERVICE_TIERS) {
      const tier = IMEI_SERVICE_TIERS[tierKey];

      expect(isImeiServiceTierKey(tierKey)).toBe(true);
      expect(tier.providerServiceId).not.toBe('');
      expect(tier.price).toBeGreaterThan(0);
      expect(tier.features.length).toBeGreaterThan(0);
      expect(tier.checksIncluded.length).toBeGreaterThan(0);
    }
  });

  it('recognizes every real tier key and rejects invalid values', () => {
    for (const tierKey of ALL_IMEI_SERVICE_TIERS) {
      expect(isImeiServiceTierKey(tierKey)).toBe(true);
    }

    expect(isImeiServiceTierKey('invalid-key')).toBe(false);
    expect(isImeiServiceTierKey('__proto__')).toBe(false);
    expect(isImeiServiceTierKey('toString')).toBe(false);
    expect(isImeiServiceTierKey('')).toBe(false);
    expect(isImeiServiceTierKey(null)).toBe(false);
  });

  it('matches brand filters against all, shared, and scoped tiers', () => {
    expect(imeiTierMatchesBrand('full', 'all')).toBe(true);
    expect(imeiTierMatchesBrand('full', 'apple')).toBe(true);
    expect(imeiTierMatchesBrand('samsung', 'samsung')).toBe(true);
    expect(imeiTierMatchesBrand('samsung', 'apple')).toBe(false);
  });

  it('declares Xiaomi lock and lost verdict fields for paid Mi tiers', () => {
    expect(IMEI_SERVICE_TIERS.miLock.checksIncluded).toContain('miLockStatus');
    expect(IMEI_SERVICE_TIERS.miLostPro.checksIncluded).toEqual(
      expect.arrayContaining(['miLockStatus', 'miLostStatus'])
    );
  });

  it('declares MDM status output for the Apple MDM tier', () => {
    expect(IMEI_SERVICE_TIERS.mdm.checksIncluded).toContain('mdmStatus');
  });

  it('omits the Apple Serial Info tier until serial-input UX exists', () => {
    // The storefront input only accepts 15-digit IMEI (`parseImei`), so a Serial
    // Info tier (Apple serial lookup) would always fail validation. Re-add once
    // a serial-input mode ships. See PR #1557 (codex P2 review).
    expect(ALL_IMEI_SERVICE_TIERS).not.toContain(
      'serialInfo' as unknown as (typeof ALL_IMEI_SERVICE_TIERS)[number]
    );
    expect(isImeiServiceTierKey('serialInfo')).toBe(false);
    expect(IMEI_SERVICE_TIERS).not.toHaveProperty('serialInfo');
  });

  it('switches between primary and expanded tier lists', () => {
    expect(getVisibleImeiServiceTierKeys('all', false)).toEqual([
      ...PRIMARY_IMEI_SERVICE_TIERS,
    ]);
    expect(getVisibleImeiServiceTierKeys('all', true)).toEqual([
      ...ALL_IMEI_SERVICE_TIERS,
    ]);
  });
});

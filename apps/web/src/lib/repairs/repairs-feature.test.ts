import { describe, expect, it } from 'vitest';
import {
  isRepairsBusinessType,
  isRepairsCatalogEnabled,
} from './repairs-feature';

describe('isRepairsBusinessType', () => {
  it('accepts the canonical electronics id', () => {
    expect(isRepairsBusinessType('electronics')).toBe(true);
  });

  it('accepts the legacy gadgets value', () => {
    expect(isRepairsBusinessType('gadgets')).toBe(true);
  });

  it('normalizes uppercase and surrounding whitespace', () => {
    expect(isRepairsBusinessType('  ELECTRONICS ')).toBe(true);
    expect(isRepairsBusinessType('GADGETS')).toBe(true);
  });

  it('rejects unrelated business types', () => {
    expect(isRepairsBusinessType('fashion')).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(isRepairsBusinessType(null)).toBe(false);
    expect(isRepairsBusinessType(undefined)).toBe(false);
  });
});

describe('isRepairsCatalogEnabled', () => {
  it('is enabled for an electronics merchant with the flag on', () => {
    expect(
      isRepairsCatalogEnabled({
        businessType: 'electronics',
        repairsCatalogEnabled: true,
      })
    ).toBe(true);
  });

  it('is enabled for a legacy gadgets merchant with the flag on', () => {
    expect(
      isRepairsCatalogEnabled({
        businessType: 'GADGETS',
        repairsCatalogEnabled: true,
      })
    ).toBe(true);
  });

  it('is disabled when the flag is off even for electronics', () => {
    expect(
      isRepairsCatalogEnabled({
        businessType: 'electronics',
        repairsCatalogEnabled: false,
      })
    ).toBe(false);
  });

  it('is disabled for a non-electronics business type', () => {
    expect(
      isRepairsCatalogEnabled({
        businessType: 'fashion',
        repairsCatalogEnabled: true,
      })
    ).toBe(false);
  });

  it('is disabled when the flag is null or undefined', () => {
    expect(
      isRepairsCatalogEnabled({
        businessType: 'electronics',
        repairsCatalogEnabled: null,
      })
    ).toBe(false);
    expect(isRepairsCatalogEnabled({ businessType: 'electronics' })).toBe(
      false
    );
  });
});

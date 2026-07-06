import { describe, expect, it } from '@jest/globals';
import { BRAND } from '@/constants/Colors';
import {
  getUtilityHistoryIconColor,
  isValidUtilityType,
} from './utility-purchase.config';

describe('getUtilityHistoryIconColor', () => {
  it('uses brand red in light mode (yellow gets lost on light surfaces)', () => {
    expect(getUtilityHistoryIconColor('light')).toBe(BRAND.primary);
  });

  it('keeps brand yellow in dark mode', () => {
    expect(getUtilityHistoryIconColor('dark')).toBe(BRAND.secondary);
  });

  it('falls back to the light-mode color when the scheme is unknown', () => {
    expect(getUtilityHistoryIconColor(null)).toBe(BRAND.primary);
    expect(getUtilityHistoryIconColor(undefined)).toBe(BRAND.primary);
  });
});

describe('isValidUtilityType', () => {
  it('accepts known utility types and rejects unknown ones', () => {
    expect(isValidUtilityType('airtime')).toBe(true);
    expect(isValidUtilityType('imei')).toBe(false);
  });
});

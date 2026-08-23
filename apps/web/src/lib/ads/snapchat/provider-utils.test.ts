import { describe, expect, it } from 'vitest';
import {
  isIsoDate,
  microToDecimal,
  snapchatAdsLocalMidnight,
} from './provider-utils';

describe('Snapchat Ads provider utilities', () => {
  it('validates dates and converts micros without losing precision', () => {
    expect(isIsoDate('2026-08-20')).toBe(true);
    expect(isIsoDate('20-08-2026')).toBe(false);
    expect(microToDecimal('9007199254740993')).toBe('9007199254.740993');
  });

  it('rejects invalid timezone input before creating a provider window', () => {
    expect(() => snapchatAdsLocalMidnight('2026-08-20', 'Not/AZone')).toThrow(
      'SNAPCHAT_ADS_TIMEZONE_INVALID'
    );
  });
});

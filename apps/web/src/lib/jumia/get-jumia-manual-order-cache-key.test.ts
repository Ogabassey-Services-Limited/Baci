import { describe, expect, it } from 'vitest';
import { getJumiaManualOrderCacheKey } from './get-jumia-manual-order-cache-key';

describe('getJumiaManualOrderCacheKey', () => {
  it('uses the neutral scope for a provider marketplace key', () => {
    expect(getJumiaManualOrderCacheKey('Jumia Nigeria')).toBe('default');
  });

  it('keeps the neutral scope for missing or existing default keys', () => {
    expect(getJumiaManualOrderCacheKey(undefined)).toBe('default');
    expect(getJumiaManualOrderCacheKey('default')).toBe('default');
  });
});

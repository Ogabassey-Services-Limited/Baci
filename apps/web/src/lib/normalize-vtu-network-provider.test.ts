import { describe, expect, it } from 'vitest';
import { normalizeVtuNetworkProvider } from '@/lib/normalize-vtu-network-provider';

describe('normalizeVtuNetworkProvider', () => {
  it.each([
    ['mtn', 'MTN'],
    ['MTN', 'MTN'],
    ['Mtn', 'MTN'],
    [' mtn ', 'MTN'],
    ['airtel', 'AIRTEL'],
    ['Airtel', 'AIRTEL'],
    [' airtel ', 'AIRTEL'],
    ['AIRTEL', 'AIRTEL'],
    ['glo', 'GLO'],
    ['Glo', 'GLO'],
    [' GLO ', 'GLO'],
    ['t2', '9MOBILE'],
    ['9mobile', '9MOBILE'],
    ['9MOBILE', '9MOBILE'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizeVtuNetworkProvider(input)).toBe(expected);
  });

  it('returns null for unknown or empty provider values', () => {
    expect(normalizeVtuNetworkProvider('UNKNOWN')).toBeNull();
    expect(normalizeVtuNetworkProvider('')).toBeNull();
    expect(normalizeVtuNetworkProvider('   ')).toBeNull();
  });
});

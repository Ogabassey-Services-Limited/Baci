import { pickMerchantId } from './pick-merchant-id';

describe('pickMerchantId', () => {
  it('returns the first non-empty candidate', () => {
    expect(pickMerchantId('merchant-1', 'merchant-2')).toBe('merchant-1');
  });

  it('skips null and undefined and returns the next valid candidate', () => {
    expect(pickMerchantId(null, undefined, 'merchant-3')).toBe('merchant-3');
  });

  it('skips empty strings (the auth-store-not-loaded case) and falls through', () => {
    expect(pickMerchantId('', 'merchant-fallback')).toBe('merchant-fallback');
  });

  it('skips whitespace-only strings and falls through', () => {
    expect(pickMerchantId('   ', '\t\n', 'merchant-fallback')).toBe(
      'merchant-fallback'
    );
  });

  it('trims whitespace from the first valid candidate', () => {
    expect(pickMerchantId('  merchant-trimmed  ')).toBe('merchant-trimmed');
  });

  it('returns null when every candidate is empty/whitespace/null/undefined', () => {
    expect(pickMerchantId(null, undefined, '', '   ')).toBeNull();
  });

  it('returns null when called with no candidates', () => {
    expect(pickMerchantId()).toBeNull();
  });

  it('preserves an internal-whitespace value (only outer is trimmed)', () => {
    expect(pickMerchantId('mer chant-x')).toBe('mer chant-x');
  });
});

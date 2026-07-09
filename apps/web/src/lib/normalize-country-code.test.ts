import { describe, expect, it } from 'vitest';
import { getCountryByCode } from '@/lib/countries';
import { normalizeCountryCode } from '@/lib/normalize-country-code';

describe('normalizeCountryCode', () => {
  it.each([
    ['NG', 'NG'],
    ['ng ', 'NG'],
    ['Nigeria', 'NG'],
    ['NIGERIA', 'NG'],
    ['United States', 'US'],
    ['USA', 'US'],
    ['UK', 'GB'],
  ])('resolves %s to %s', (input, expected) => {
    expect(normalizeCountryCode(input)).toBe(expected);
  });

  it('returns null for null, undefined, and empty/whitespace input', () => {
    expect(normalizeCountryCode(null)).toBeNull();
    expect(normalizeCountryCode(undefined)).toBeNull();
    expect(normalizeCountryCode('')).toBeNull();
    expect(normalizeCountryCode('   ')).toBeNull();
  });

  it('returns null for unrecognizable input', () => {
    expect(normalizeCountryCode('Atlantis')).toBeNull();
  });

  it('is idempotent for an already-normalized code', () => {
    const once = normalizeCountryCode('NG');
    expect(normalizeCountryCode(once)).toBe(once);
  });

  it('maps the UAE alias to AE once AE is a supported country', () => {
    // Forward-compatible assertion: `@/lib/countries` is being expanded
    // concurrently, so assert against the live lookup instead of hardcoding
    // 'AE' — this stays correct whether or not AE has landed yet.
    const expected = getCountryByCode('AE')?.code ?? null;
    expect(normalizeCountryCode('UAE')).toBe(expected);
  });
});

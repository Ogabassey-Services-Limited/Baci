import { describe, expect, it } from 'vitest';
import { normalizeGooglePlaceId } from '@/lib/google-place-id-normalization';

describe('normalizeGooglePlaceId', () => {
  it('normalizes raw place IDs and place resource names without schema dependencies', () => {
    expect(normalizeGooglePlaceId(' ChIJ1234 ')).toBe('ChIJ1234');
    expect(normalizeGooglePlaceId('places/ChIJ1234')).toBe('ChIJ1234');
  });

  it('rejects empty or malformed place IDs', () => {
    expect(normalizeGooglePlaceId('../../etc/passwd')).toBeNull();
    expect(normalizeGooglePlaceId('')).toBeNull();
    expect(normalizeGooglePlaceId('   ')).toBeNull();
    expect(normalizeGooglePlaceId('places/')).toBeNull();
    expect(normalizeGooglePlaceId(null)).toBeNull();
    expect(normalizeGooglePlaceId(undefined)).toBeNull();
  });

  it('accepts place IDs with underscores and hyphens', () => {
    expect(normalizeGooglePlaceId('ChIJ_1234')).toBe('ChIJ_1234');
    expect(normalizeGooglePlaceId('ChIJ-5678')).toBe('ChIJ-5678');
    expect(normalizeGooglePlaceId('places/ChIJ_mixed-123')).toBe(
      'ChIJ_mixed-123'
    );
  });
});

import { describe, expect, it } from 'vitest';
import { normalizeGooglePlaceId } from '@/lib/google-place-id';

describe('normalizeGooglePlaceId', () => {
  it('normalizes raw place IDs and place resource names', () => {
    expect(normalizeGooglePlaceId(' ChIJ1234 ')).toBe('ChIJ1234');
    expect(normalizeGooglePlaceId('places/ChIJ1234')).toBe('ChIJ1234');
  });

  it('rejects empty or malformed place IDs', () => {
    expect(normalizeGooglePlaceId('../../etc/passwd')).toBeNull();
    expect(normalizeGooglePlaceId('')).toBeNull();
    expect(normalizeGooglePlaceId(null)).toBeNull();
    expect(normalizeGooglePlaceId(undefined)).toBeNull();
  });
});

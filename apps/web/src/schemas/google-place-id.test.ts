import { describe, expect, it } from 'vitest';
import { googlePlaceIdSchema } from '@/schemas/google-place-id';

describe('googlePlaceIdSchema', () => {
  it('parses raw Place IDs and place resource names', () => {
    expect(googlePlaceIdSchema.parse(' ChIJ1234 ')).toBe('ChIJ1234');
    expect(googlePlaceIdSchema.parse('places/ChIJ1234')).toBe('ChIJ1234');
  });

  it('rejects empty or malformed Place IDs', () => {
    expect(googlePlaceIdSchema.safeParse('../../etc/passwd').success).toBe(
      false
    );
    expect(googlePlaceIdSchema.safeParse('').success).toBe(false);
    expect(googlePlaceIdSchema.safeParse('places/').success).toBe(false);
  });
});

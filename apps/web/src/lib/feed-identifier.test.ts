import { describe, expect, it } from 'vitest';
import { isUuid } from '@/lib/feed-identifier';

describe('isUuid', () => {
  it('returns true for a valid UUID v4', () => {
    expect(isUuid('00000000-0000-4000-8000-000000000001')).toBe(true);
  });

  it('returns true for uppercase UUIDs', () => {
    expect(isUuid('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(true);
  });

  it('returns false for a slug', () => {
    expect(isUuid('ogabassey')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isUuid('')).toBe(false);
  });

  it('returns false for a UUID missing dashes', () => {
    expect(isUuid('00000000000040008000000000000001')).toBe(false);
  });
});

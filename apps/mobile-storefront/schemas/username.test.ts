import { describe, expect, it } from '@jest/globals';
import { getUsernameValidationError, UsernameSchema } from '@/schemas/username';

describe('UsernameSchema', () => {
  it('accepts a valid username with mixed letters, numbers, and separators', () => {
    const result = UsernameSchema.safeParse('oga_fan.1');

    expect(result.success).toBe(true);
  });

  it('trims surrounding whitespace before validating', () => {
    const result = UsernameSchema.safeParse('  ogafan  ');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('ogafan');
    }
  });

  it('rejects usernames shorter than the minimum length', () => {
    const result = UsernameSchema.safeParse('ab');

    expect(result.success).toBe(false);
  });

  it('rejects usernames longer than the maximum length', () => {
    const result = UsernameSchema.safeParse('a'.repeat(21));

    expect(result.success).toBe(false);
  });

  it('rejects usernames that start with a separator', () => {
    const result = UsernameSchema.safeParse('.ogafan');

    expect(result.success).toBe(false);
  });

  it('rejects usernames that end with a separator', () => {
    const result = UsernameSchema.safeParse('ogafan_');

    expect(result.success).toBe(false);
  });

  it('rejects usernames with consecutive separators', () => {
    const result = UsernameSchema.safeParse('oga..fan');

    expect(result.success).toBe(false);
  });

  it('accepts the minimum boundary length', () => {
    const result = UsernameSchema.safeParse('ab1');

    expect(result.success).toBe(true);
  });

  it('accepts the maximum boundary length', () => {
    const result = UsernameSchema.safeParse('a'.repeat(20));

    expect(result.success).toBe(true);
  });
});

describe('getUsernameValidationError', () => {
  it('returns null for a valid username', () => {
    expect(getUsernameValidationError('ogafan')).toBeNull();
  });

  it('returns a friendly message for a too-short username', () => {
    expect(getUsernameValidationError('ab')).toBe('Use 3-20 characters');
  });

  it('returns a friendly message for a username starting with a separator', () => {
    expect(getUsernameValidationError('.abc')).toContain(
      'Start and end with a letter or number'
    );
  });

  it('returns a friendly message for consecutive separators', () => {
    expect(getUsernameValidationError('ab..cd')).toBe(
      'Avoid consecutive . or _ characters'
    );
  });
});

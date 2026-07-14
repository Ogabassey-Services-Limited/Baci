import { describe, expect, it } from 'vitest';
import { isValidTwitterProfileHandle } from './twitter-profile-handle';

describe('isValidTwitterProfileHandle', () => {
  it('accepts valid profile handles', () => {
    expect(isValidTwitterProfileHandle('ogabassey')).toBe(true);
    expect(isValidTwitterProfileHandle('MTN_NG')).toBe(true);
  });

  it('rejects reserved routes and invalid handle syntax', () => {
    expect(isValidTwitterProfileHandle('home')).toBe(false);
    expect(isValidTwitterProfileHandle('compose')).toBe(false);
    expect(isValidTwitterProfileHandle('not a handle')).toBe(false);
    expect(isValidTwitterProfileHandle('a'.repeat(16))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { constantTimeEqual } from './constant-time-equal';

describe('constantTimeEqual', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEqual('secret-token-abc', 'secret-token-abc')).toBe(
      true
    );
  });

  it('returns false for different content of the same length', () => {
    expect(constantTimeEqual('aaaa', 'bbbb')).toBe(false);
  });

  it('returns false for length-mismatched inputs', () => {
    expect(constantTimeEqual('short', 'a-much-longer-string')).toBe(false);
  });
});

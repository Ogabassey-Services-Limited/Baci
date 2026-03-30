import { describe, expect, it } from 'vitest';
import { constantTimeEqual } from './constant-time-equal';

describe('constantTimeEqual', () => {
  it('returns true for identical strings', () => {
    expect(constantTimeEqual('secret123', 'secret123')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(constantTimeEqual('secret123', 'secret456')).toBe(false);
  });

  it('returns false for strings of different lengths', () => {
    expect(constantTimeEqual('short', 'much-longer-string')).toBe(false);
  });

  it('returns true for empty strings', () => {
    expect(constantTimeEqual('', '')).toBe(true);
  });

  it('handles Unicode/multi-byte strings correctly', () => {
    expect(constantTimeEqual('秘密🔐', '秘密🔐')).toBe(true);
    expect(constantTimeEqual('秘密🔐', '秘密🔒')).toBe(false);
  });

  it('handles strings with embedded null bytes', () => {
    expect(constantTimeEqual('a\0b', 'a\0b')).toBe(true);
    expect(constantTimeEqual('a\0b', 'a\0c')).toBe(false);
  });
});

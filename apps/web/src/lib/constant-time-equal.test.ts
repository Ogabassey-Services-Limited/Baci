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
});

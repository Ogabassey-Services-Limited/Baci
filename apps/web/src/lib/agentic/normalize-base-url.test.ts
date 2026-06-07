import { describe, expect, it } from 'vitest';
import { normalizeBaseUrl } from './normalize-base-url';

describe('normalizeBaseUrl', () => {
  it('trims whitespace and trailing slashes', () => {
    expect(normalizeBaseUrl(' https://merchant.example/// ')).toBe(
      'https://merchant.example'
    );
  });

  it('rejects malformed URLs', () => {
    expect(() => normalizeBaseUrl('not-a-url')).toThrow(TypeError);
  });
});

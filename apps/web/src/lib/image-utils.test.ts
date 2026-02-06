import { describe, expect, it } from 'vitest';
import { generateColorBlur } from './image-utils';

describe('generateColorBlur', () => {
  it('should generate a valid base64 string', () => {
    const result = generateColorBlur('#ffffff');
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('should generate different strings for different colors', () => {
    const white = generateColorBlur('#ffffff');
    const black = generateColorBlur('#000000');
    expect(white).not.toBe(black);
  });

  it('should return same string for same color (idempotent)', () => {
    const result1 = generateColorBlur('#ffffff');
    const result2 = generateColorBlur('#ffffff');
    expect(result1).toBe(result2);
  });
});

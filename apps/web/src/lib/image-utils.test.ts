import { describe, expect, it } from 'vitest';
import { generateColorBlur, getProductBlurPlaceholder } from './image-utils';

describe('image-utils', () => {
  describe('generateColorBlur', () => {
    it('should generate a valid base64 svg data url', () => {
      const result = generateColorBlur('#ffffff');
      expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
      // Base64 for <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="#ffffff" width="1" height="1"/></svg>
      // Is PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IGZpbGw9IiNmZmZmZmYiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48L3N2Zz4=
      expect(result).toContain(
        'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IGZpbGw9IiNmZmZmZmYiIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz48L3N2Zz4='
      );
    });

    it('should return consistent results for the same color', () => {
      const result1 = generateColorBlur('#ffffff');
      const result2 = generateColorBlur('#ffffff');
      expect(result1).toBe(result2);
    });

    it('should handle different colors', () => {
      const white = generateColorBlur('#ffffff');
      const black = generateColorBlur('#000000');
      expect(white).not.toBe(black);
    });

    it('should handle default argument', () => {
      const result = generateColorBlur();
      expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    });
  });

  describe('getProductBlurPlaceholder', () => {
    it('should return a blur string for known category', () => {
      const result = getProductBlurPlaceholder('fashion');
      expect(result).toBeDefined();
      expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('should return a blur string for unknown category (default)', () => {
      const result = getProductBlurPlaceholder('unknown-category-xyz');
      expect(result).toBeDefined();
      expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    });

    it('should be case insensitive', () => {
      const result1 = getProductBlurPlaceholder('Fashion');
      const result2 = getProductBlurPlaceholder('fashion');
      expect(result1).toBe(result2);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { extractProductListVariantAttributes } from './product-list-variant-attributes';

describe('extractProductListVariantAttributes', () => {
  it('collects each supported variant attribute once and ignores incomplete rows', () => {
    const attributes = extractProductListVariantAttributes([
      { attributes: { color: 'Black', storage: '128GB', size: 'M' } },
      { attributes: { color: 'Black', storage: '256GB', size: 'L' } },
      { attributes: { color: 'Gold' } },
      { attributes: null },
      {},
    ]);

    expect(attributes).toEqual({
      colors: ['Black', 'Gold'],
      storage_options: ['128GB', '256GB'],
      available_sizes: ['M', 'L'],
    });
  });
});

import { describe, expect, it } from 'vitest';
import { getBlogCategoryLookup } from './get-blog-category-lookup';

describe('getBlogCategoryLookup', () => {
  it('keeps exact candidates and canonical punctuation variants', () => {
    const lookup = getBlogCategoryLookup(["women's-fashion", 'product-news']);

    expect(lookup.candidates).toEqual([
      "women's-fashion",
      "women's fashion",
      "Women's Fashion",
      'product-news',
      'product news',
      'Product News',
    ]);
    expect(lookup.canonicalSlugs).toEqual(['womens-fashion', 'product-news']);
    expect(lookup.canonicalFilter).toContain(
      'category.ilike.*women*s*fashion*'
    );
    expect(lookup.canonicalFilter).toContain('category.ilike.*product*news*');
  });
});

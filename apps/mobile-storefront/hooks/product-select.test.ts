import { describe, expect, it } from '@jest/globals';
import { PRODUCT_DETAIL_SELECT, PRODUCT_SELECT } from './product-select';

describe('product Supabase projections', () => {
  it('keeps catalog reads off the protected product_variants relationship', () => {
    expect(PRODUCT_SELECT).not.toContain('product_variants');
    expect(PRODUCT_SELECT).not.toMatch(/\bvariants\s*:/);
    expect(PRODUCT_SELECT).toContain('has_variants');
    expect(PRODUCT_SELECT).toContain('variant_attributes');
  });

  it('keeps product detail reads off the protected product_variants relationship', () => {
    expect(PRODUCT_DETAIL_SELECT).not.toContain('product_variants');
    expect(PRODUCT_DETAIL_SELECT).not.toMatch(/\bvariants\s*:/);
    expect(PRODUCT_DETAIL_SELECT).toContain('has_variants');
    expect(PRODUCT_DETAIL_SELECT).toContain('variant_model');
    expect(PRODUCT_DETAIL_SELECT).toContain('variant_attributes');
  });

  it('does not select removed products.colors columns', () => {
    expect(PRODUCT_SELECT).not.toMatch(/\bcolors\b/);
    expect(PRODUCT_DETAIL_SELECT).not.toMatch(/\bcolors\b/);
  });
});

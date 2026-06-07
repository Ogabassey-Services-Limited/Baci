import { describe, expect, it } from 'vitest';
import {
  STOREFRONT_PRODUCTS_COMPACT_SELECT,
  STOREFRONT_PRODUCTS_SELECT,
} from './storefront-products-select';

describe('STOREFRONT_PRODUCTS_SELECT', () => {
  it('includes the fields needed by storefront product routes', () => {
    expect(STOREFRONT_PRODUCTS_SELECT.trim()).not.toBe('');
    expect(STOREFRONT_PRODUCTS_SELECT).toEqual(expect.stringContaining('id'));
    expect(STOREFRONT_PRODUCTS_SELECT).toEqual(expect.stringContaining('name'));
    expect(STOREFRONT_PRODUCTS_SELECT).toEqual(
      expect.stringContaining('price')
    );
    expect(STOREFRONT_PRODUCTS_SELECT).toEqual(
      expect.stringContaining('categories:category_id(id, name, slug)')
    );
    expect(STOREFRONT_PRODUCTS_SELECT).toContain('product_key_specs (');
    expect(STOREFRONT_PRODUCTS_SELECT).toContain('updated_at');
  });

  it('keeps the compact storefront product select free of PDP-only payloads', () => {
    expect(STOREFRONT_PRODUCTS_COMPACT_SELECT.trim()).not.toBe('');
    expect(STOREFRONT_PRODUCTS_COMPACT_SELECT).not.toMatch(/\bdescription\b/);
    expect(STOREFRONT_PRODUCTS_COMPACT_SELECT).toEqual(
      expect.stringContaining('has_variants')
    );
    expect(STOREFRONT_PRODUCTS_COMPACT_SELECT).toEqual(
      expect.stringContaining('categories:category_id(id, name, slug)')
    );
    expect(STOREFRONT_PRODUCTS_COMPACT_SELECT).not.toEqual(
      expect.stringContaining('specifications')
    );
    expect(STOREFRONT_PRODUCTS_COMPACT_SELECT).not.toEqual(
      expect.stringContaining('product_key_specs')
    );
    expect(STOREFRONT_PRODUCTS_COMPACT_SELECT).not.toEqual(
      expect.stringContaining('variant_attributes')
    );
    expect(STOREFRONT_PRODUCTS_COMPACT_SELECT).not.toMatch(/\bmerchant_id\b/);
    expect(STOREFRONT_PRODUCTS_COMPACT_SELECT).not.toMatch(/\boffers\b/);
  });
});

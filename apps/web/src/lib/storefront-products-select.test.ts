import { describe, expect, it } from 'vitest';
import { STOREFRONT_PRODUCTS_SELECT } from './storefront-products-select';

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
  });
});

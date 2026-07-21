import { describe, expect, it } from 'vitest';
import { isBrandAuthorityProductInStock } from './brand-authority-stock-filter';

describe('isBrandAuthorityProductInStock', () => {
  it('uses hydrated managed-stock values', () => {
    expect(
      isBrandAuthorityProductInStock({
        id: 'product-1',
        name: 'Samsung Galaxy',
        price: 100,
        manage_stock: true,
        stock: 0,
        stock_quantity: 0,
      })
    ).toBe(false);
  });

  it('keeps hydrated unlimited inventory purchasable', () => {
    expect(
      isBrandAuthorityProductInStock({
        id: 'product-1',
        name: 'Samsung Galaxy',
        price: 100,
        manage_stock: false,
        stock: 9999,
      })
    ).toBe(true);
  });
});

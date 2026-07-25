import { describe, expect, it } from 'vitest';
import { prepareCreditDirectAmounts } from './credit-direct-products';

const items = [
  { id: 'phone', name: 'Phone', price: 10000, quantity: 1 },
  { id: 'case', name: 'Case', price: 5000, quantity: 1 },
];

describe('prepareCreditDirectAmounts', () => {
  it('allocates the exact gateway total and assigns the remainder deterministically', () => {
    const result = prepareCreditDirectAmounts(items, 10000);

    expect(result).toEqual({
      products: [
        {
          productAmount: 6666.66,
          productId: 'phone',
          productName: 'Phone',
        },
        {
          productAmount: 3333.34,
          productId: 'case',
          productName: 'Case',
        },
      ],
      totalAmount: 10000,
    });
    expect(
      result.products.reduce((sum, product) => sum + product.productAmount, 0)
    ).toBe(result.totalAmount);
  });

  it('rejects a total with fractional minor units', () => {
    expect(() => prepareCreditDirectAmounts(items, 10000.001)).toThrow(
      'Credit Direct checkout amount must use at most two decimal places'
    );
  });

  it('accepts a valid high-value total despite floating-point multiplication noise', () => {
    const result = prepareCreditDirectAmounts(items, 1234567.89);

    expect(result.totalAmount).toBe(1234567.89);
    expect(
      result.products.reduce(
        (sum, product) => sum + Math.round(product.productAmount * 100),
        0
      )
    ).toBe(123456789);
  });

  it('accepts a cent-aligned residual after multiple floating-point subtractions', () => {
    const residual = 437331.94 - 287634.1 - 123509.89;
    const result = prepareCreditDirectAmounts(items, residual);

    expect(result.totalAmount).toBe(26187.95);
    expect(
      result.products.reduce(
        (sum, product) => sum + Math.round(product.productAmount * 100),
        0
      )
    ).toBe(2618795);
  });

  it('keeps every product amount positive after an extreme discount', () => {
    const result = prepareCreditDirectAmounts(
      [
        { id: 'small', name: 'Small item', price: 1, quantity: 1 },
        {
          id: 'large',
          name: 'Large item',
          price: 2000000,
          quantity: 1,
        },
      ],
      10000
    );

    expect(result.products).toEqual([
      {
        productAmount: 0.01,
        productId: 'small',
        productName: 'Small item',
      },
      {
        productAmount: 9999.99,
        productId: 'large',
        productName: 'Large item',
      },
    ]);
  });

  it('assigns an allocatable minor unit to a free line in a paid basket', () => {
    const result = prepareCreditDirectAmounts(
      [
        { id: 'paid', name: 'Paid item', price: 100, quantity: 1 },
        { id: 'free', name: 'Free item', price: 0, quantity: 1 },
      ],
      100
    );

    expect(result.products).toEqual([
      {
        productAmount: 99.99,
        productId: 'paid',
        productName: 'Paid item',
      },
      {
        productAmount: 0.01,
        productId: 'free',
        productName: 'Free item',
      },
    ]);
  });

  it('allocates a shipping-only total across fully voucher-covered items', () => {
    const result = prepareCreditDirectAmounts(
      [
        { id: 'voucher-phone', name: 'Voucher phone', price: 0, quantity: 1 },
        { id: 'voucher-case', name: 'Voucher case', price: 0, quantity: 1 },
      ],
      5000
    );

    expect(result).toEqual({
      products: [
        {
          productAmount: 2500,
          productId: 'voucher-phone',
          productName: 'Voucher phone',
        },
        {
          productAmount: 2500,
          productId: 'voucher-case',
          productName: 'Voucher case',
        },
      ],
      totalAmount: 5000,
    });
  });

  it('rejects totals too small to keep every product amount positive', () => {
    expect(() => prepareCreditDirectAmounts(items, 0.01)).toThrow(
      'Credit Direct checkout total cannot allocate a positive amount to every item'
    );
  });

  it.each([
    { invalidItems: [], label: 'an empty basket' },
    {
      invalidItems: [{ ...items[0], price: -1 }],
      label: 'a negative item total',
    },
  ])('rejects $label', ({ invalidItems }) => {
    expect(() => prepareCreditDirectAmounts(invalidItems, 10000)).toThrow(
      'Credit Direct checkout requires items with a positive total'
    );
  });
});

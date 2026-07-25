import { describe, expect, it } from 'vitest';
import { prepareLegacyCreditDirectCheckout } from './prepare-legacy-credit-direct-checkout';

const orderItems = [
  {
    product_id: 'phone',
    name: 'Phone',
    price: 10000,
    quantity: 1,
  },
  {
    product_id: 'case',
    name: 'Case',
    price: 5000,
    quantity: 1,
  },
];

describe('prepareLegacyCreditDirectCheckout', () => {
  it.each([
    {
      expectedAmounts: [10800, 5400],
      label: 'shipping increases the signed total',
      totalAmount: 16200,
    },
    {
      expectedAmounts: [6000, 3000],
      label: 'discounts or credits reduce the signed total',
      totalAmount: 9000,
    },
  ])('keeps legacy popup products equal to the signed total when $label', ({
    expectedAmounts,
    totalAmount,
  }) => {
    const result = prepareLegacyCreditDirectCheckout(orderItems, totalAmount);

    expect(result.totalAmount).toBe(totalAmount);
    expect(result.products.map((product) => product.productAmount)).toEqual(
      expectedAmounts
    );
    expect(
      result.products.reduce((sum, product) => sum + product.productAmount, 0)
    ).toBe(result.totalAmount);
  });
});

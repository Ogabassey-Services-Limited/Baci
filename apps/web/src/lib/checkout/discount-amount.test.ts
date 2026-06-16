import { describe, expect, it } from 'vitest';
import {
  computeDiscountAmountForSubtotal,
  type DiscountCodeForAmount,
} from '@/lib/checkout/discount-amount';

const pct: DiscountCodeForAmount = {
  discount_type: 'percentage',
  discount_value: 10,
  maximum_discount_amount: null,
};

describe('computeDiscountAmountForSubtotal', () => {
  it('rounds a percentage of the subtotal', () => {
    expect(computeDiscountAmountForSubtotal(pct, 5005)).toBe(501);
  });

  it('caps at maximum_discount_amount', () => {
    expect(
      computeDiscountAmountForSubtotal(
        { ...pct, maximum_discount_amount: 300 },
        5000
      )
    ).toBe(300);
  });

  it('honors a maximum_discount_amount of 0 (not truthy)', () => {
    expect(
      computeDiscountAmountForSubtotal(
        { ...pct, maximum_discount_amount: 0 },
        5000
      )
    ).toBe(0);
  });

  it('clamps a fixed amount to the subtotal', () => {
    expect(
      computeDiscountAmountForSubtotal(
        {
          discount_type: 'fixed',
          discount_value: 9000,
          maximum_discount_amount: null,
        },
        5000
      )
    ).toBe(5000);
  });

  it('caps a fixed amount at maximum_discount_amount', () => {
    expect(
      computeDiscountAmountForSubtotal(
        {
          discount_type: 'fixed',
          discount_value: 4000,
          maximum_discount_amount: 1000,
        },
        5000
      )
    ).toBe(1000);
  });

  it('never exceeds subtotal for a percentage', () => {
    expect(
      computeDiscountAmountForSubtotal(
        {
          discount_type: 'percentage',
          discount_value: 150,
          maximum_discount_amount: null,
        },
        5000
      )
    ).toBe(5000);
  });
});

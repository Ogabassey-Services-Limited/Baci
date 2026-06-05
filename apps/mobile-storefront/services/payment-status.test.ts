import { describe, expect, it } from '@jest/globals';
import { getInitialPaymentStatus } from './payment-status';

describe('getInitialPaymentStatus', () => {
  it.each([
    'invoice',
    'payforme',
    'pay_on_delivery',
  ])('marks %s as a pending actionable order', (paymentMethod) => {
    expect(getInitialPaymentStatus(paymentMethod)).toBe('pending');
  });

  it.each([
    'paystack',
    'korapay',
    'bank_transfer',
  ])('marks %s as an unpaid checkout attempt', (paymentMethod) => {
    expect(getInitialPaymentStatus(paymentMethod)).toBe('unpaid');
  });
});

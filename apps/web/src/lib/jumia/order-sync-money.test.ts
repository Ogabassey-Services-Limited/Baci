import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { item } from './order-sync.test-helpers';
import {
  calculateJumiaOrderMoney,
  mapJumiaPaymentStatus,
} from './order-sync-money';

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('Jumia order sync money helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates order money with integer minor-unit arithmetic', () => {
    expect(calculateJumiaOrderMoney('order-1', 250000, [item])).toEqual({
      total: 250000,
      subtotal: 255000,
      shippingFee: 0,
      taxAmount: 0,
      discountAmount: 5000,
      originalTotal: 255000,
    });
  });

  it('logs when subtotal is clamped below zero', () => {
    const money = calculateJumiaOrderMoney('order-1', 1, [
      {
        ...item,
        shippingAmount: 10,
        taxAmount: 0,
        voucherAmount: 0,
      },
    ]);

    expect(money.subtotal).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Clamped negative Jumia order subtotal to zero',
        jumiaOrderId: 'order-1',
      })
    );
  });

  it('coerces non-finite money inputs to zero', () => {
    const money = calculateJumiaOrderMoney(
      'order-1',
      Number.POSITIVE_INFINITY,
      [
        {
          ...item,
          shippingAmount: Number.NaN,
          taxAmount: Number.POSITIVE_INFINITY,
          voucherAmount: Number.NEGATIVE_INFINITY,
        },
      ]
    );

    expect(money).toEqual({
      total: 0,
      subtotal: 0,
      shippingFee: 0,
      taxAmount: 0,
      discountAmount: 0,
      originalTotal: 0,
    });
    // calculateJumiaOrderMoney only warns when derived totals become invalid;
    // non-finite upstream money fields are normalized before arithmetic.
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('maps terminal COD and prepaid payment states correctly', () => {
    expect(mapJumiaPaymentStatus('cancelled', false)).toBe('unpaid');
    expect(mapJumiaPaymentStatus('returned', true)).toBe('refunded');
    expect(mapJumiaPaymentStatus('shipped', false)).toBe('pending');
    expect(mapJumiaPaymentStatus('delivered', true)).toBe('paid');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { notifyKlumpPaidOrder } from '@/lib/klump-payment-notifications';

const mocks = vi.hoisted(() => ({
  logger: {
    warn: vi.fn(),
  },
  notifyNewOrder: vi.fn(),
  notifyPaymentReceived: vi.fn(),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyNewOrder: (...args: unknown[]) => mocks.notifyNewOrder(...args),
  notifyPaymentReceived: (...args: unknown[]) =>
    mocks.notifyPaymentReceived(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: mocks.logger,
}));

describe('notifyKlumpPaidOrder', () => {
  it('sends order and payment notifications with a stable order number', async () => {
    mocks.notifyNewOrder.mockResolvedValue(undefined);
    mocks.notifyPaymentReceived.mockResolvedValue(undefined);

    await notifyKlumpPaidOrder({
      amount: 50000,
      currency: 'NGN',
      merchantId: 'merchant-123',
      order: {
        customer_name: null,
        id: 'order-123456789',
        order_number: null,
      },
    });

    expect(mocks.notifyNewOrder).toHaveBeenCalledWith(
      'merchant-123',
      'order-123456789',
      'ORDER-12',
      'Customer',
      50000,
      'NGN'
    );
    expect(mocks.notifyPaymentReceived).toHaveBeenCalledWith(
      'merchant-123',
      50000,
      'NGN',
      'ORDER-12',
      'order-123456789'
    );
  });

  it('logs notification failures without throwing', async () => {
    const error = new Error('push unavailable');
    mocks.notifyNewOrder.mockRejectedValue(error);

    await expect(
      notifyKlumpPaidOrder({
        amount: 50000,
        currency: 'NGN',
        merchantId: 'merchant-123',
        order: {
          customer_name: 'Buyer',
          id: 'order-123',
          order_number: 'ORD-123',
        },
      })
    ).resolves.toBeUndefined();
    expect(mocks.logger.warn).toHaveBeenCalledWith({
      error,
      message: 'Klump payment notification failed',
    });
  });
});

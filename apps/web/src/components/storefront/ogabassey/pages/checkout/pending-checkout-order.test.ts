import { describe, expect, it, vi } from 'vitest';
import {
  buildPendingCheckoutFingerprint,
  normalizeOrderPaymentMethod,
  resolvePendingCheckoutOrder,
  type PendingCheckoutOrderSnapshot,
} from './pending-checkout-order';

describe('pending-checkout-order', () => {
  it('maps payment methods to persisted order values', () => {
    expect(normalizeOrderPaymentMethod('paystack')).toBe('card');
    expect(normalizeOrderPaymentMethod('korapay')).toBe('card');
    expect(normalizeOrderPaymentMethod('bank_transfer')).toBe('bank_transfer');
    expect(normalizeOrderPaymentMethod('payforme')).toBe('payforme');
    expect(normalizeOrderPaymentMethod('pod')).toBe('pod');
  });

  it('builds the same fingerprint regardless of item order', () => {
    const base = {
      merchantId: 'merchant-1',
      customerEmail: 'John@example.com',
      customerName: 'John Doe',
      customerPhone: '+2348012345678',
      deliveryMethod: 'door',
      shippingFee: 2000,
      shippingProvider: 'GIGL',
      selectedQuoteId: 'quote-1',
      shippingAddress: {
        address: '123 Test Street',
        city: 'Ikeja',
        state: 'Lagos',
        phone: '+2348012345678',
      },
      useWalletCredit: false,
      walletAmountUsed: 0,
    } as const;

    const fingerprintA = buildPendingCheckoutFingerprint({
      ...base,
      items: [
        {
          product_id: 'product-b',
          name: 'Phone Case',
          quantity: 1,
          price: 5000,
        },
        {
          product_id: 'product-a',
          name: 'iPhone',
          quantity: 1,
          price: 100000,
        },
      ],
    });

    const fingerprintB = buildPendingCheckoutFingerprint({
      ...base,
      items: [
        {
          product_id: 'product-a',
          name: 'iPhone',
          quantity: 1,
          price: 100000,
        },
        {
          product_id: 'product-b',
          name: 'Phone Case',
          quantity: 1,
          price: 5000,
        },
      ],
    });

    expect(fingerprintA).toBe(fingerprintB);
  });

  it('reuses a matching unpaid pending order', async () => {
    const pendingOrder: PendingCheckoutOrderSnapshot = {
      orderId: 'order-123',
      orderNumber: 'ORD-123',
      trackingToken: 'tracking-token-123',
      merchantId: 'merchant-1',
      customerEmail: 'john@example.com',
      checkoutFingerprint: 'fingerprint-1',
      amountDueToGateway: 12000,
      createdAt: '2026-04-09T09:00:00.000Z',
    };

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'order-123',
          total: 12000,
          payment_status: 'pending',
          shipping_status: 'pending',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          order: {
            id: 'order-123',
            order_number: 'ORD-123',
            tracking_token: 'tracking-token-123',
          },
        }),
      } as Response);

    const result = await resolvePendingCheckoutOrder({
      pendingOrder,
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      customerEmail: 'john@example.com',
      checkoutFingerprint: 'fingerprint-1',
      paymentMethod: 'card',
      shippingProvider: 'GIGL',
      selectedQuoteId: 'quote-1',
      fetchImpl,
    });

    expect(result).toEqual({
      reusableOrder: {
        order: {
          id: 'order-123',
          order_number: 'ORD-123',
          tracking_token: 'tracking-token-123',
        },
        amountDueToGateway: 12000,
      },
      clearStoredOrder: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('clears the stored order when the fingerprint no longer matches', async () => {
    const result = await resolvePendingCheckoutOrder({
      pendingOrder: {
        orderId: 'order-123',
        trackingToken: 'tracking-token-123',
        merchantId: 'merchant-1',
        customerEmail: 'john@example.com',
        checkoutFingerprint: 'old-fingerprint',
        amountDueToGateway: 12000,
        createdAt: '2026-04-09T09:00:00.000Z',
      },
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      customerEmail: 'john@example.com',
      checkoutFingerprint: 'new-fingerprint',
      paymentMethod: 'card',
      shippingProvider: 'GIGL',
      fetchImpl: vi.fn<typeof fetch>(),
    });

    expect(result).toEqual({
      reusableOrder: null,
      clearStoredOrder: true,
    });
  });
});

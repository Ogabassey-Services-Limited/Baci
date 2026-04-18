import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { executeDirectPayment } from './direct-payment';
import type { ExecuteDirectPaymentOptions } from './direct-payment';
import type { ResumedOrder } from '../types';

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

// Mock CredPal
const mockOpenCredPalCheckout = vi.fn();
const mockGetCredPalKey = vi.fn(() => 'test-credpal-key');
vi.mock('@/lib/credpal', () => ({
  openCredPalCheckout: (...args: unknown[]) =>
    mockOpenCredPalCheckout(...args),
  getCredPalKey: () => mockGetCredPalKey(),
}));

// Mock Credit Direct
const mockOpenCreditDirectCheckout = vi.fn();
vi.mock('@/lib/credit-direct-client', () => ({
  openCreditDirectCheckout: (...args: unknown[]) =>
    mockOpenCreditDirectCheckout(...args),
}));

describe('executeDirectPayment', () => {
  const mockResumedOrder: ResumedOrder = {
    id: 'order-123',
    short_id: 'ORD-123',
    subtotal: 10000,
    shipping_cost: 2000,
    total: 12000,
    customer_name: 'John Doe',
    customer_email: 'john@example.com',
    customer_phone: '+2348012345678',
    tracking_token: 'track-token-123',
    shipping_address: {
      address: '123 Test St, Ikeja, Lagos',
      city: 'Ikeja',
      state: 'Lagos',
      phone: '+2348012345678',
    },
    items: [
      {
        id: 'item-1',
        product_id: 'prod-1',
        product_name: 'Test Product',
        quantity: 2,
        price: 5000,
      },
    ],
  };

  const defaultOpts: ExecuteDirectPaymentOptions = {
    resumedOrder: mockResumedOrder,
    preferredGateway: 'credpal',
    merchantSlug: 'test-store',
    setIsProcessing: vi.fn(),
    clearCheckoutSession: vi.fn(),
    routerPush: vi.fn(),
    getHref: vi.fn((path: string) => `/test-store${path}`),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenCredPalCheckout.mockResolvedValue(undefined);
    mockOpenCreditDirectCheckout.mockResolvedValue(undefined);
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    ) as Mock;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Early Returns', () => {
    it('returns early if resumedOrder is null', async () => {
      await executeDirectPayment({
        ...defaultOpts,
        resumedOrder: null,
      });
      expect(defaultOpts.setIsProcessing).not.toHaveBeenCalled();
    });

    it('returns early if preferredGateway is null', async () => {
      await executeDirectPayment({
        ...defaultOpts,
        preferredGateway: null,
      });
      expect(defaultOpts.setIsProcessing).not.toHaveBeenCalled();
    });
  });

  describe('CredPal Payment', () => {
    it('sets processing to true before payment', async () => {
      await executeDirectPayment(defaultOpts);
      expect(defaultOpts.setIsProcessing).toHaveBeenCalledWith(true);
    });

    it('calls openCredPalCheckout with correct params', async () => {
      await executeDirectPayment(defaultOpts);
      expect(mockOpenCredPalCheckout).toHaveBeenCalledTimes(1);
      const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];
      expect(callArgs.key).toBe('test-credpal-key');
      expect(callArgs.amount).toBe(12000);
      expect(callArgs.product).toBe('Test Product');
      expect(callArgs.customerEmail).toBe('john@example.com');
      expect(callArgs.customerName).toBe('John Doe');
      expect(callArgs.customerPhone).toBe('+2348012345678');
    });

    it('joins multiple product names', async () => {
      const multiItemOrder = {
        ...mockResumedOrder,
        items: [
          ...mockResumedOrder.items,
          {
            id: 'item-2',
            product_id: 'prod-2',
            product_name: 'Another Product',
            quantity: 1,
            price: 3000,
          },
        ],
      };
      await executeDirectPayment({
        ...defaultOpts,
        resumedOrder: multiItemOrder,
      });
      const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];
      expect(callArgs.product).toBe('Test Product, Another Product');
    });

    it('uses "Purchase" as product name when items array is empty', async () => {
      const orderWithNoItems: ResumedOrder = {
        ...mockResumedOrder,
        items: [],
      };
      await executeDirectPayment({
        ...defaultOpts,
        resumedOrder: orderWithNoItems,
      });
      const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];
      expect(callArgs.product).toBe('Purchase');
    });

    describe('onSuccess callback', () => {
      it('calls update-payment-ref API with correct params', async () => {
        await executeDirectPayment(defaultOpts);
        const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];
        await callArgs.onSuccess({ order_no: 'credpal-ref-123' });

        expect(global.fetch).toHaveBeenCalledWith(
          '/api/orders/update-payment-ref',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: 'order-123',
              paymentRef: 'credpal-ref-123',
              gateway: 'credpal',
            }),
          },
        );
      });

      it('clears checkout session after successful payment', async () => {
        await executeDirectPayment(defaultOpts);
        const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];
        await callArgs.onSuccess({ order_no: 'credpal-ref-123' });

        expect(defaultOpts.clearCheckoutSession).toHaveBeenCalled();
      });

      it('navigates to order success page with correct query params', async () => {
        await executeDirectPayment(defaultOpts);
        const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];
        await callArgs.onSuccess({ order_no: 'credpal-ref-123' });

        expect(defaultOpts.routerPush).toHaveBeenCalledWith(
          '/test-store/order-success?orderId=order-123&type=credpal&trackingToken=track-token-123',
        );
      });

      it('still proceeds even if API call fails', async () => {
        global.fetch = vi.fn(() =>
          Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Update failed' }),
          }),
        ) as Mock;

        await executeDirectPayment(defaultOpts);
        const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];
        await callArgs.onSuccess({ order_no: 'credpal-ref-123' });

        expect(defaultOpts.clearCheckoutSession).toHaveBeenCalled();
        expect(defaultOpts.routerPush).toHaveBeenCalled();
      });
    });

    describe('onError callback', () => {
      it('shows toast with error message', async () => {
        await executeDirectPayment(defaultOpts);
        const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];
        callArgs.onError({ message: 'Insufficient credit' });

        expect(mockToast).toHaveBeenCalledWith({
          title: 'Payment Failed',
          description: 'Insufficient credit',
          variant: 'destructive',
        });
      });

      it('uses default message when error.message is missing', async () => {
        await executeDirectPayment(defaultOpts);
        const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];
        callArgs.onError({});

        expect(mockToast).toHaveBeenCalledWith({
          title: 'Payment Failed',
          description: 'CredPal payment failed',
          variant: 'destructive',
        });
      });

      it('sets processing to false', async () => {
        await executeDirectPayment(defaultOpts);
        const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];
        callArgs.onError({ message: 'Payment failed' });

        expect(defaultOpts.setIsProcessing).toHaveBeenCalledWith(false);
      });
    });

    describe('onClose callback', () => {
      it('sets processing to false when modal is closed', async () => {
        await executeDirectPayment(defaultOpts);
        const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];
        callArgs.onClose();

        expect(defaultOpts.setIsProcessing).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('Credit Direct Payment', () => {
    it('calls openCreditDirectCheckout with correct params', async () => {
      await executeDirectPayment({
        ...defaultOpts,
        preferredGateway: 'credit_direct',
      });
      expect(mockOpenCreditDirectCheckout).toHaveBeenCalledTimes(1);
      const callArgs = mockOpenCreditDirectCheckout.mock.calls[0][0];
      expect(callArgs.merchantSlug).toBe('test-store');
      expect(callArgs.orderId).toBe('order-123');
      expect(callArgs.amount).toBe(12000);
      expect(callArgs.customerEmail).toBe('john@example.com');
    });

    it('maps item fields correctly', async () => {
      await executeDirectPayment({
        ...defaultOpts,
        preferredGateway: 'credit_direct',
      });
      const callArgs = mockOpenCreditDirectCheckout.mock.calls[0][0];
      expect(callArgs.items).toEqual([
        { id: 'prod-1', name: 'Test Product', price: 5000, quantity: 2 },
      ]);
    });

    it('falls back to ogabassey slug when merchantSlug is empty', async () => {
      await executeDirectPayment({
        ...defaultOpts,
        preferredGateway: 'credit_direct',
        merchantSlug: '',
      });
      const callArgs = mockOpenCreditDirectCheckout.mock.calls[0][0];
      expect(callArgs.merchantSlug).toBe('ogabassey');
    });

    describe('onSuccess callback', () => {
      it('calls update-payment-ref API with correct params', async () => {
        await executeDirectPayment({
          ...defaultOpts,
          preferredGateway: 'credit_direct',
        });
        const callArgs = mockOpenCreditDirectCheckout.mock.calls[0][0];
        await callArgs.onSuccess('cd-transaction-456');

        expect(global.fetch).toHaveBeenCalledWith(
          '/api/orders/update-payment-ref',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: 'order-123',
              paymentRef: 'cd-transaction-456',
              gateway: 'credit_direct',
            }),
          },
        );
      });

      it('clears checkout session after successful payment', async () => {
        await executeDirectPayment({
          ...defaultOpts,
          preferredGateway: 'credit_direct',
        });
        const callArgs = mockOpenCreditDirectCheckout.mock.calls[0][0];
        await callArgs.onSuccess('cd-transaction-456');

        expect(defaultOpts.clearCheckoutSession).toHaveBeenCalled();
      });

      it('navigates to order success page with correct query params', async () => {
        await executeDirectPayment({
          ...defaultOpts,
          preferredGateway: 'credit_direct',
        });
        const callArgs = mockOpenCreditDirectCheckout.mock.calls[0][0];
        await callArgs.onSuccess('cd-transaction-456');

        expect(defaultOpts.routerPush).toHaveBeenCalledWith(
          '/test-store/order-success?orderId=order-123&type=credit_direct&trackingToken=track-token-123',
        );
      });
    });

    describe('onError callback', () => {
      it('shows toast with error message', async () => {
        await executeDirectPayment({
          ...defaultOpts,
          preferredGateway: 'credit_direct',
        });
        const callArgs = mockOpenCreditDirectCheckout.mock.calls[0][0];
        callArgs.onError('Transaction declined');

        expect(mockToast).toHaveBeenCalledWith({
          title: 'Payment Failed',
          description: 'Transaction declined',
          variant: 'destructive',
        });
      });

      it('uses default message when error string is empty', async () => {
        await executeDirectPayment({
          ...defaultOpts,
          preferredGateway: 'credit_direct',
        });
        const callArgs = mockOpenCreditDirectCheckout.mock.calls[0][0];
        callArgs.onError('');

        expect(mockToast).toHaveBeenCalledWith({
          title: 'Payment Failed',
          description: 'Credit Direct payment failed',
          variant: 'destructive',
        });
      });

      it('sets processing to false', async () => {
        await executeDirectPayment({
          ...defaultOpts,
          preferredGateway: 'credit_direct',
        });
        const callArgs = mockOpenCreditDirectCheckout.mock.calls[0][0];
        callArgs.onError('Payment failed');

        expect(defaultOpts.setIsProcessing).toHaveBeenCalledWith(false);
      });
    });

    describe('onClose callback', () => {
      it('sets processing to false when modal is closed', async () => {
        await executeDirectPayment({
          ...defaultOpts,
          preferredGateway: 'credit_direct',
        });
        const callArgs = mockOpenCreditDirectCheckout.mock.calls[0][0];
        callArgs.onClose();

        expect(defaultOpts.setIsProcessing).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('sets processing to false on credpal SDK error', async () => {
      mockOpenCredPalCheckout.mockRejectedValue(new Error('SDK error'));
      await executeDirectPayment(defaultOpts);
      expect(defaultOpts.setIsProcessing).toHaveBeenCalledWith(false);
      expect(console.error).toHaveBeenCalledWith(
        'Payment execution error:',
        expect.any(Error),
      );
    });

    it('sets processing to false on credit_direct SDK error', async () => {
      mockOpenCreditDirectCheckout.mockRejectedValue(
        new Error('Credit Direct SDK error'),
      );
      await executeDirectPayment({
        ...defaultOpts,
        preferredGateway: 'credit_direct',
      });
      expect(defaultOpts.setIsProcessing).toHaveBeenCalledWith(false);
      expect(console.error).toHaveBeenCalledWith(
        'Payment execution error:',
        expect.any(Error),
      );
    });

    it('handles network errors during API call in credpal onSuccess', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error')),
      ) as Mock;

      await executeDirectPayment(defaultOpts);
      const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];

      await expect(
        callArgs.onSuccess({ order_no: 'credpal-ref-123' }),
      ).rejects.toThrow('Network error');
    });

    it('handles network errors during API call in credit_direct onSuccess', async () => {
      global.fetch = vi.fn(() =>
        Promise.reject(new Error('Network error')),
      ) as Mock;

      await executeDirectPayment({
        ...defaultOpts,
        preferredGateway: 'credit_direct',
      });
      const callArgs = mockOpenCreditDirectCheckout.mock.calls[0][0];

      await expect(callArgs.onSuccess('cd-transaction-456')).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles single item in order', async () => {
      const singleItemOrder: ResumedOrder = {
        ...mockResumedOrder,
        items: [
          {
            id: 'item-1',
            product_id: 'prod-1',
            product_name: 'Single Product',
            quantity: 1,
            price: 12000,
          },
        ],
      };
      await executeDirectPayment({
        ...defaultOpts,
        resumedOrder: singleItemOrder,
      });
      const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];
      expect(callArgs.product).toBe('Single Product');
    });

    it('handles zero total amount', async () => {
      const zeroAmountOrder: ResumedOrder = {
        ...mockResumedOrder,
        subtotal: 0,
        shipping_cost: 0,
        total: 0,
      };
      await executeDirectPayment({
        ...defaultOpts,
        resumedOrder: zeroAmountOrder,
      });
      const callArgs = mockOpenCredPalCheckout.mock.calls[0][0];
      expect(callArgs.amount).toBe(0);
    });

    it('handles items without image_url for credit_direct', async () => {
      const itemsWithoutImages: ResumedOrder = {
        ...mockResumedOrder,
        items: [
          {
            id: 'item-1',
            product_id: 'prod-1',
            product_name: 'Product A',
            quantity: 2,
            price: 5000,
          },
          {
            id: 'item-2',
            product_id: 'prod-2',
            product_name: 'Product B',
            quantity: 1,
            price: 2000,
          },
        ],
      };
      await executeDirectPayment({
        ...defaultOpts,
        preferredGateway: 'credit_direct',
        resumedOrder: itemsWithoutImages,
      });
      const callArgs = mockOpenCreditDirectCheckout.mock.calls[0][0];
      expect(callArgs.items).toEqual([
        { id: 'prod-1', name: 'Product A', price: 5000, quantity: 2 },
        { id: 'prod-2', name: 'Product B', price: 2000, quantity: 1 },
      ]);
    });

    it('handles empty merchant slug for credpal', async () => {
      await executeDirectPayment({
        ...defaultOpts,
        merchantSlug: '',
      });
      expect(mockOpenCredPalCheckout).toHaveBeenCalled();
    });

    it('handles both resumedOrder and preferredGateway as null', async () => {
      await executeDirectPayment({
        ...defaultOpts,
        resumedOrder: null,
        preferredGateway: null,
      });
      expect(defaultOpts.setIsProcessing).not.toHaveBeenCalled();
      expect(mockOpenCredPalCheckout).not.toHaveBeenCalled();
      expect(mockOpenCreditDirectCheckout).not.toHaveBeenCalled();
    });
  });
});

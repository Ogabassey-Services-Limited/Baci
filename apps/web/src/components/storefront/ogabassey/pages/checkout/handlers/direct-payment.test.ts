import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeDirectPayment } from './direct-payment';
import type { ExecuteDirectPaymentOptions } from './direct-payment';
import type { ResumedOrder } from '../types';

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
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
  });

  describe('Error Handling', () => {
    it('sets processing to false on error', async () => {
      mockOpenCredPalCheckout.mockRejectedValue(new Error('SDK error'));
      await executeDirectPayment(defaultOpts);
      expect(defaultOpts.setIsProcessing).toHaveBeenCalledWith(false);
    });
  });
});

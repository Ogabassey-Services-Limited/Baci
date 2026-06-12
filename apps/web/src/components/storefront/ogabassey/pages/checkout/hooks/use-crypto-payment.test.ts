import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCryptoPayment } from './use-crypto-payment';
import type { CryptoPaymentData, PendingCryptoOrder } from '../types';
import { toast } from '@/hooks/use-toast';

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('useCryptoPayment', () => {
  const mockMerchantId = 'merchant-123';
  const mockClearCheckoutSession = vi.fn();
  const mockClearCart = vi.fn();
  const mockRouterPush = vi.fn();
  const mockGetHref = vi.fn((path: string) => `/storefront${path}`);

  const defaultOptions = {
    merchantId: mockMerchantId,
    clearCheckoutSession: mockClearCheckoutSession,
    clearCart: mockClearCart,
    routerPush: mockRouterPush,
    getHref: mockGetHref,
  };

  const mockPendingOrder: PendingCryptoOrder = {
    orderId: 'order-123',
    amount: 50000,
    customerEmail: 'test@example.com',
    customerName: 'Test User',
    customerPhone: '+2348012345678',
    billingAddress: {
      line1: '123 Main St',
      city: 'Lagos',
      state: 'Lagos',
      country: 'NG',
      zip_code: '100001',
    },
    items: [{ name: 'Product 1', type: 'physical' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      expect(result.current.cryptoPaymentData).toBeNull();
      expect(result.current.isVerifyingCrypto).toBe(false);
      expect(result.current.cryptoVerificationStatus).toBe('idle');
      expect(result.current.showCryptoSelector).toBe(false);
      expect(result.current.selectedCryptoChain).toBe('TRX');
      expect(result.current.selectedCryptoCurrency).toBe('USDT');
      expect(result.current.pendingCryptoOrder).toBeNull();
      expect(result.current.isInitializingCrypto).toBe(false);
    });
  });

  describe('handleCryptoCurrencyChange', () => {
    it('should update currency and keep chain if supported', () => {
      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setSelectedCryptoChain('ETH');
      });

      act(() => {
        result.current.handleCryptoCurrencyChange('USDC');
      });

      expect(result.current.selectedCryptoCurrency).toBe('USDC');
      expect(result.current.selectedCryptoChain).toBe('ETH');
    });

    it('should reset chain to first supported if current chain is unsupported', () => {
      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setSelectedCryptoChain('TRX');
      });

      act(() => {
        result.current.handleCryptoCurrencyChange('USDC');
      });

      expect(result.current.selectedCryptoCurrency).toBe('USDC');
      expect(result.current.selectedCryptoChain).toBe('ETH');
    });

    it('should reset to ETH when switching to USDC with unsupported TRX chain', () => {
      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      // TRX is the default chain for USDT
      expect(result.current.selectedCryptoChain).toBe('TRX');

      act(() => {
        result.current.handleCryptoCurrencyChange('USDC');
      });

      expect(result.current.selectedCryptoCurrency).toBe('USDC');
      // TRX is not supported on USDC, so it resets to ETH (first in USDC list)
      expect(result.current.selectedCryptoChain).toBe('ETH');
    });
  });

  describe('initializeCryptoPayment', () => {
    it('should return early if no pendingCryptoOrder', async () => {
      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      await act(async () => {
        await result.current.initializeCryptoPayment();
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current.isInitializingCrypto).toBe(false);
    });

    it('should return early if no merchantId', async () => {
      const { result } = renderHook(() =>
        useCryptoPayment({ ...defaultOptions, merchantId: undefined }),
      );

      act(() => {
        result.current.setPendingCryptoOrder(mockPendingOrder);
      });

      await act(async () => {
        await result.current.initializeCryptoPayment();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should successfully initialize crypto payment', async () => {
      const mockResponse = {
        success: true,
        reference: 'ref-123',
        session_id: 'session-123',
        crypto_payment: {
          address: '0x1234567890abcdef',
          chain: 'TRX',
          currency: 'USDT',
          amount: 5000000,
          confirmation_time: '2026-02-08T10:00:00Z',
          payment_id: 'payment-123',
          qrcode: 'data:image/png;base64,abc123',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setPendingCryptoOrder(mockPendingOrder);
      });

      await act(async () => {
        await result.current.initializeCryptoPayment();
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: mockMerchantId,
          order_id: mockPendingOrder.orderId,
          currency: 'NGN',
          customer_email: mockPendingOrder.customerEmail,
          customer_name: mockPendingOrder.customerName,
          customer_phone: mockPendingOrder.customerPhone,
          gateway: 'juicyway',
          billing_address: mockPendingOrder.billingAddress,
          items: mockPendingOrder.items,
          crypto_chain: 'TRX',
          crypto_currency: 'USDT',
        }),
      });

      expect(result.current.cryptoPaymentData).toEqual({
        address: '0x1234567890abcdef',
        chain: 'TRX',
        currency: 'USDT',
        amount: 50000,
        confirmation_time: '2026-02-08T10:00:00Z',
        orderId: 'order-123',
        reference: 'ref-123',
        sessionId: 'session-123',
        paymentId: 'payment-123',
        qrcode: 'data:image/png;base64,abc123',
      });

      expect(result.current.showCryptoSelector).toBe(false);
      expect(result.current.isInitializingCrypto).toBe(false);
    });

    it('should handle API error with error details', async () => {
      const errorResponse = {
        details: 'Payment provider error',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => errorResponse,
      });

      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setPendingCryptoOrder(mockPendingOrder);
      });

      await act(async () => {
        await result.current.initializeCryptoPayment();
      });

      expect(toast).toHaveBeenCalledWith({
        title: 'Crypto Payment Failed',
        description: 'Payment provider error',
        variant: 'destructive',
      });

      expect(result.current.cryptoPaymentData).toBeNull();
      expect(result.current.isInitializingCrypto).toBe(false);
    });

    it('should handle API error with generic error field', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Generic error' }),
      });

      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setPendingCryptoOrder(mockPendingOrder);
      });

      await act(async () => {
        await result.current.initializeCryptoPayment();
      });

      expect(toast).toHaveBeenCalledWith({
        title: 'Crypto Payment Failed',
        description: 'Generic error',
        variant: 'destructive',
      });
    });

    it('should handle missing crypto_payment in response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false }),
      });

      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setPendingCryptoOrder(mockPendingOrder);
      });

      await act(async () => {
        await result.current.initializeCryptoPayment();
      });

      expect(toast).toHaveBeenCalledWith({
        title: 'Crypto Payment Failed',
        description: 'Failed to generate crypto payment address',
        variant: 'destructive',
      });
    });

    it('should handle network error', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new Error('Network connection failed'),
      );

      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setPendingCryptoOrder(mockPendingOrder);
      });

      await act(async () => {
        await result.current.initializeCryptoPayment();
      });

      expect(toast).toHaveBeenCalledWith({
        title: 'Crypto Payment Failed',
        description: 'Network connection failed',
        variant: 'destructive',
      });
    });
  });

  describe('verifyCryptoPayment', () => {
    const mockCryptoPaymentData: CryptoPaymentData = {
      address: '0xabcdef',
      chain: 'TRX',
      currency: 'USDT',
      amount: 50000,
      confirmation_time: '2026-02-08T10:00:00Z',
      orderId: 'order-123',
      reference: 'ref-123',
      sessionId: 'session-123',
      paymentId: 'payment-123',
    };

    it('should set status to failed if no paymentId or sessionId', async () => {
      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      await act(async () => {
        await result.current.verifyCryptoPayment();
      });

      expect(result.current.cryptoVerificationStatus).toBe('failed');
      expect(result.current.isVerifyingCrypto).toBe(false);
    });

    it('should immediately navigate on confirmed status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ is_confirmed: true }),
      });

      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setCryptoPaymentData(mockCryptoPaymentData);
      });

      await act(async () => {
        await result.current.verifyCryptoPayment();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/payments/status?gateway=juicyway&payment_id=payment-123',
      );

      expect(mockClearCheckoutSession).toHaveBeenCalled();
      expect(mockClearCart).toHaveBeenCalled();
      expect(mockRouterPush).toHaveBeenCalledWith(
        '/storefront/order-success?type=crypto&orderId=order-123&reference=ref-123',
      );

      expect(result.current.cryptoVerificationStatus).toBe('confirmed');
      expect(result.current.isVerifyingCrypto).toBe(false);
    });

    it('should immediately set failed status on failed payment', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ is_failed: true }),
      });

      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setCryptoPaymentData(mockCryptoPaymentData);
      });

      await act(async () => {
        await result.current.verifyCryptoPayment();
      });

      expect(result.current.cryptoVerificationStatus).toBe('failed');
      expect(result.current.isVerifyingCrypto).toBe(false);
    });

    it('should start polling on pending status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setCryptoPaymentData(mockCryptoPaymentData);
      });

      await act(async () => {
        await result.current.verifyCryptoPayment();
      });

      expect(result.current.cryptoVerificationStatus).toBe('pending');
      expect(result.current.isVerifyingCrypto).toBe(true);
    });

    it('should confirm payment during polling', async () => {
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({}),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ is_confirmed: true }),
        });
      });

      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setCryptoPaymentData(mockCryptoPaymentData);
      });

      await act(async () => {
        await result.current.verifyCryptoPayment();
      });

      expect(result.current.cryptoVerificationStatus).toBe('pending');
      expect(result.current.isVerifyingCrypto).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
        await Promise.resolve();
      });

      expect(result.current.cryptoVerificationStatus).toBe('confirmed');
      expect(result.current.isVerifyingCrypto).toBe(false);
      expect(mockRouterPush).toHaveBeenCalled();
    });

    it('should fail payment during polling', async () => {
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({}),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ is_failed: true }),
        });
      });

      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setCryptoPaymentData(mockCryptoPaymentData);
      });

      await act(async () => {
        await result.current.verifyCryptoPayment();
      });

      expect(result.current.cryptoVerificationStatus).toBe('pending');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000);
        await Promise.resolve();
      });

      expect(result.current.cryptoVerificationStatus).toBe('failed');
      expect(result.current.isVerifyingCrypto).toBe(false);
    });

    it('should stop polling after max attempts', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setCryptoPaymentData(mockCryptoPaymentData);
      });

      await act(async () => {
        await result.current.verifyCryptoPayment();
      });

      expect(result.current.cryptoVerificationStatus).toBe('pending');
      expect(result.current.isVerifyingCrypto).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000 * 30);
        await Promise.resolve();
      });

      expect(result.current.isVerifyingCrypto).toBe(false);
      expect(result.current.cryptoVerificationStatus).toBe('pending');
    });

    it('should handle API error during status check', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setCryptoPaymentData(mockCryptoPaymentData);
      });

      await act(async () => {
        await result.current.verifyCryptoPayment();
      });

      expect(result.current.cryptoVerificationStatus).toBe('pending');
      expect(result.current.isVerifyingCrypto).toBe(true);
    });

    it('should use sessionId if paymentId is not available', async () => {
      const dataWithoutPaymentId = {
        ...mockCryptoPaymentData,
        paymentId: '',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ is_confirmed: true }),
      });

      const { result } = renderHook(() => useCryptoPayment(defaultOptions));

      act(() => {
        result.current.setCryptoPaymentData(dataWithoutPaymentId);
      });

      await act(async () => {
        await result.current.verifyCryptoPayment();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/payments/status?gateway=juicyway&payment_id=session-123',
      );
    });
  });

  describe('Cleanup', () => {
    it('should clear polling interval on unmount', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const { result, unmount } = renderHook(() =>
        useCryptoPayment(defaultOptions),
      );

      act(() => {
        result.current.setCryptoPaymentData({
          address: '0xabcdef',
          chain: 'TRX',
          currency: 'USDT',
          amount: 50000,
          confirmation_time: '2026-02-08T10:00:00Z',
          orderId: 'order-123',
          reference: 'ref-123',
          sessionId: 'session-123',
          paymentId: 'payment-123',
        });
      });

      await act(async () => {
        await result.current.verifyCryptoPayment();
      });

      expect(result.current.isVerifyingCrypto).toBe(true);

      unmount();

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
    });
  });
});

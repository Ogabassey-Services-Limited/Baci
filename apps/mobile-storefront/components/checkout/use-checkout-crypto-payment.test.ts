import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { PendingCryptoOrder } from './checkout-screen.constants';
import {
  CHECKOUT_API_BASE_URL,
  CHECKOUT_MERCHANT_ID,
} from './checkout-screen.constants';
import { useCheckoutCryptoPayment } from './use-checkout-crypto-payment';

const mockFetch = jest.fn<typeof fetch>();

jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

describe('useCheckoutCryptoPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  const mockOrder: PendingCryptoOrder['order'] = {
    id: 'order-123',
    order_number: 'ORD-123',
    total: 1000,
    payment_status: 'pending',
    shipping_status: 'pending',
    created_at: '2026-06-23T20:00:00.000Z',
    tracking_token: 'token-123',
  };
  const mockPendingOrder: PendingCryptoOrder = {
    order: mockOrder,
    orderResponse: {
      amountDueToGateway: 1000,
      order: mockOrder,
      wallet: null,
      savings: null,
    },
    customerEmail: 'test@example.com',
    customerName: 'John Doe',
    customerPhone: '1234567890',
    trackingToken: 'token-123',
  };

  it('initializes crypto payment successfully', async () => {
    const isOrderInFlight = { current: false };
    const setIsProcessing = jest.fn();
    const total = 1000;

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        reference: 'ref-123',
        crypto_payment: {
          address: '0x123',
          amount: 1000,
          chain: 'TRC20',
          currency: 'USDT',
          crypto_amount: '1.0',
          confirmation_time: '10 min',
          payment_id: 'pay-123',
        },
      }),
    } as Response);

    const { result } = renderHook(() =>
      useCheckoutCryptoPayment({ isOrderInFlight, setIsProcessing, total })
    );

    await act(async () => {
      result.current.setPendingOrder(mockPendingOrder);
    });

    await act(async () => {
      await result.current.handleCryptoConfirm('TRC20', 'USDT');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      `${CHECKOUT_API_BASE_URL}/api/payments/initialize`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Idempotency-Key': 'crypto-init-order-123-TRC20-USDT',
        }),
        body: JSON.stringify({
          merchant_id: CHECKOUT_MERCHANT_ID,
          order_id: 'order-123',
          currency: 'NGN',
          customer_email: 'test@example.com',
          customer_name: 'John Doe',
          customer_phone: '1234567890',
          gateway: 'juicyway',
          crypto_chain: 'TRC20',
          crypto_currency: 'USDT',
        }),
      })
    );

    expect(result.current.cryptoPayment).toEqual({
      orderId: 'order-123',
      orderNumber: 'ORD-123',
      address: '0x123',
      chain: 'TRC20',
      currency: 'USDT',
      amount: 1000,
      cryptoAmount: '1.0',
      confirmationTime: '10 min',
      reference: 'ref-123',
      paymentId: 'pay-123',
      trackingToken: 'token-123',
    });
    expect(setIsProcessing).toHaveBeenCalledWith(false);
    expect(isOrderInFlight.current).toBe(false);
  });

  it('prevents payment if order total has changed', async () => {
    const isOrderInFlight = { current: false };
    const setIsProcessing = jest.fn();
    const total = 2000; // Total is 2000, but pendingOrder says 1000

    const { result } = renderHook(() =>
      useCheckoutCryptoPayment({ isOrderInFlight, setIsProcessing, total })
    );

    await act(async () => {
      result.current.setPendingOrder(mockPendingOrder);
      result.current.setShowCryptoSelection(true);
    });

    await act(async () => {
      await result.current.handleCryptoConfirm('TRC20', 'USDT');
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Amount Changed',
      expect.any(String),
      [{ text: 'OK' }]
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.showCryptoSelection).toBe(false);
  });

  it('handles payment initialization error', async () => {
    const isOrderInFlight = { current: true };
    const setIsProcessing = jest.fn();
    const total = 1000;

    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Unsupported currency',
      }),
    } as Response);

    const { result } = renderHook(() =>
      useCheckoutCryptoPayment({ isOrderInFlight, setIsProcessing, total })
    );

    await act(async () => {
      result.current.setPendingOrder(mockPendingOrder);
      result.current.setShowCryptoSelection(true);
    });

    await act(async () => {
      await result.current.handleCryptoConfirm('TRC20', 'USDT');
    });

    expect(mockFetch).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Payment Error',
      'Unsupported currency'
    );
    expect(setIsProcessing).toHaveBeenCalledWith(false);
    expect(result.current.showCryptoSelection).toBe(false);
    expect(isOrderInFlight.current).toBe(false);
    expect(result.current.cryptoPayment).toBeNull();
  });

  it('handles network failure during payment initialization', async () => {
    const isOrderInFlight = { current: true };
    const setIsProcessing = jest.fn();
    const total = 1000;

    mockFetch.mockRejectedValue(new Error('NetworkError'));

    const { result } = renderHook(() =>
      useCheckoutCryptoPayment({ isOrderInFlight, setIsProcessing, total })
    );

    await act(async () => {
      result.current.setPendingOrder(mockPendingOrder);
      result.current.setShowCryptoSelection(true);
    });

    await act(async () => {
      await result.current.handleCryptoConfirm('TRC20', 'USDT');
    });

    expect(mockFetch).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to initialize payment'
    );
    expect(setIsProcessing).toHaveBeenCalledWith(false);
    expect(result.current.showCryptoSelection).toBe(false);
    expect(isOrderInFlight.current).toBe(false);
    expect(result.current.cryptoPayment).toBeNull();
  });
});

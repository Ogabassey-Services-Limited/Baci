import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDvaPayment } from './use-dva-payment';
import type { DvaData } from '../types';

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

const { toast } = await import('@/hooks/use-toast');

describe('useDvaPayment', () => {
  const mockOptions = {
    merchantId: 'merchant-123',
    customerEmail: 'test@example.com',
    customerPhone: '+2348012345678',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockOrder = { id: 'order-123' };
  const mockPaymentAmount = 50000;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useDvaPayment(mockOptions));

    expect(result.current.dvaData).toBeNull();
    expect(result.current.isInitializingDva).toBe(false);
    expect(result.current.dvaCountdown).toBe(3600);
  });

  it('exposes setter functions', () => {
    const { result } = renderHook(() => useDvaPayment(mockOptions));

    expect(typeof result.current.setDvaData).toBe('function');
    expect(typeof result.current.setDvaCountdown).toBe('function');
    expect(typeof result.current.handleBankTransfer).toBe('function');
  });

  describe('handleBankTransfer', () => {
    it('returns early if merchantId is not provided', async () => {
      const optionsWithoutMerchant = { ...mockOptions, merchantId: undefined };
      const { result } = renderHook(() => useDvaPayment(optionsWithoutMerchant));
      const isOrderInFlightRef = { current: true };
      const setIsProcessing = vi.fn();

      await act(async () => {
        await result.current.handleBankTransfer(
          mockOrder,
          mockPaymentAmount,
          isOrderInFlightRef,
          setIsProcessing,
        );
      });

      expect(isOrderInFlightRef.current).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(setIsProcessing).not.toHaveBeenCalled();
    });

    it('initializes DVA successfully and sets dvaData', async () => {
      const mockDvaResponse = {
        account_number: '1234567890',
        account_name: 'Virtual Account',
        bank_name: 'Test Bank',
        bank_code: '123',
      };

      const mockResponse = {
        success: true,
        dva: mockDvaResponse,
        reference: 'REF-123',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useDvaPayment(mockOptions));
      const isOrderInFlightRef = { current: true };
      const setIsProcessing = vi.fn();

      await act(async () => {
        await result.current.handleBankTransfer(
          mockOrder,
          mockPaymentAmount,
          isOrderInFlightRef,
          setIsProcessing,
        );
      });

      const expectedDvaData: DvaData = {
        ...mockDvaResponse,
        amount: mockPaymentAmount,
        reference: 'REF-123',
      };

      expect(result.current.dvaData).toEqual(expectedDvaData);
      expect(result.current.dvaCountdown).toBe(3600);
      expect(isOrderInFlightRef.current).toBe(false);
      expect(setIsProcessing).toHaveBeenCalledWith(false);
      expect(result.current.isInitializingDva).toBe(false);
      expect(toast).not.toHaveBeenCalled();
    });

    it('sends correct request body to API', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          dva: {
            account_number: '1234567890',
            account_name: 'Virtual Account',
            bank_name: 'Test Bank',
            bank_code: '123',
          },
          reference: 'REF-123',
        }),
      });

      const { result } = renderHook(() => useDvaPayment(mockOptions));
      const isOrderInFlightRef = { current: true };
      const setIsProcessing = vi.fn();

      await act(async () => {
        await result.current.handleBankTransfer(
          mockOrder,
          mockPaymentAmount,
          isOrderInFlightRef,
          setIsProcessing,
        );
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: 'merchant-123',
          order_id: 'order-123',
          currency: 'NGN',
          customer_email: 'test@example.com',
          customer_name: 'John Doe',
          customer_phone: '+2348012345678',
          gateway: 'paystack',
          payment_type: 'dva',
        }),
      });
    });

    it('handles non-ok response with error message', async () => {
      const errorMessage = 'Payment gateway unavailable';
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: errorMessage }),
      });

      const { result } = renderHook(() => useDvaPayment(mockOptions));
      const isOrderInFlightRef = { current: true };
      const setIsProcessing = vi.fn();

      await act(async () => {
        await result.current.handleBankTransfer(
          mockOrder,
          mockPaymentAmount,
          isOrderInFlightRef,
          setIsProcessing,
        );
      });

      expect(result.current.dvaData).toBeNull();
      expect(isOrderInFlightRef.current).toBe(false);
      expect(setIsProcessing).toHaveBeenCalledWith(false);
      expect(toast).toHaveBeenCalledWith({
        title: 'Bank Transfer Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    });

    it('handles non-ok response without error message', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const { result } = renderHook(() => useDvaPayment(mockOptions));
      const isOrderInFlightRef = { current: true };
      const setIsProcessing = vi.fn();

      await act(async () => {
        await result.current.handleBankTransfer(
          mockOrder,
          mockPaymentAmount,
          isOrderInFlightRef,
          setIsProcessing,
        );
      });

      expect(toast).toHaveBeenCalledWith({
        title: 'Bank Transfer Failed',
        description: 'Failed to initialize bank transfer',
        variant: 'destructive',
      });
    });

    it('handles network error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error'),
      );

      const { result } = renderHook(() => useDvaPayment(mockOptions));
      const isOrderInFlightRef = { current: true };
      const setIsProcessing = vi.fn();

      await act(async () => {
        await result.current.handleBankTransfer(
          mockOrder,
          mockPaymentAmount,
          isOrderInFlightRef,
          setIsProcessing,
        );
      });

      expect(result.current.dvaData).toBeNull();
      expect(isOrderInFlightRef.current).toBe(false);
      expect(setIsProcessing).toHaveBeenCalledWith(false);
      expect(toast).toHaveBeenCalledWith({
        title: 'Bank Transfer Failed',
        description: 'Network error',
        variant: 'destructive',
      });
    });

    it('handles missing DVA in response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { result } = renderHook(() => useDvaPayment(mockOptions));
      const isOrderInFlightRef = { current: true };
      const setIsProcessing = vi.fn();

      await act(async () => {
        await result.current.handleBankTransfer(
          mockOrder,
          mockPaymentAmount,
          isOrderInFlightRef,
          setIsProcessing,
        );
      });

      expect(result.current.dvaData).toBeNull();
      expect(isOrderInFlightRef.current).toBe(false);
      expect(toast).toHaveBeenCalledWith({
        title: 'Bank Transfer Failed',
        description: 'DVA not returned by the gateway',
        variant: 'destructive',
      });
    });

    it('always calls setIsProcessing(false) in finally block', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Test error'),
      );

      const { result } = renderHook(() => useDvaPayment(mockOptions));
      const isOrderInFlightRef = { current: true };
      const setIsProcessing = vi.fn();

      await act(async () => {
        await result.current.handleBankTransfer(
          mockOrder,
          mockPaymentAmount,
          isOrderInFlightRef,
          setIsProcessing,
        );
      });

      expect(setIsProcessing).toHaveBeenCalledWith(false);
      expect(result.current.isInitializingDva).toBe(false);
    });
  });
});

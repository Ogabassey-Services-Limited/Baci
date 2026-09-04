import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRepairBookingSubmit } from './use-repair-booking-submit';

const mocks = vi.hoisted(() => ({
  createRepair: vi.fn(),
  startCustomerRepairPickupPayment: vi.fn(),
}));

vi.mock('@/app/actions/repair', () => ({
  createRepair: mocks.createRepair,
}));

vi.mock('@/app/actions/repair-pickup-payment', () => ({
  startCustomerRepairPickupPayment: mocks.startCustomerRepairPickupPayment,
}));

describe('useRepairBookingSubmit', () => {
  it('routes drop-off bookings through createRepair', async () => {
    mocks.createRepair.mockResolvedValue({ success: true, ticketNumber: 42 });
    const onSuccess = vi.fn();
    const toast = vi.fn();
    const { result } = renderHook(() =>
      useRepairBookingSubmit({
        applyShippingQuote: vi.fn(),
        merchantId: 'merchant-1',
        merchantSlug: 'shop',
        onPickupPaymentReady: vi.fn(),
        onSuccess,
        setCurrentStep: vi.fn(),
        shippingQuote: null,
        toast,
      })
    );

    await act(async () => {
      await result.current.onSubmit({
        serviceType: 'dropoff',
      } as never);
    });

    expect(mocks.createRepair).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith(42);
  });

  it('includes the ticket number when pickup payment initialization fails', async () => {
    mocks.startCustomerRepairPickupPayment.mockResolvedValue({
      success: false,
      code: 'payment_initialization_failed',
      error:
        'Your repair request was saved, but payment could not start. Use your ticket to retry shortly.',
      ticketNumber: 42,
    });
    const toast = vi.fn();
    const { result } = renderHook(() =>
      useRepairBookingSubmit({
        applyShippingQuote: vi.fn(),
        merchantId: 'merchant-1',
        merchantSlug: 'shop',
        onPickupPaymentReady: vi.fn(),
        onSuccess: vi.fn(),
        setCurrentStep: vi.fn(),
        shippingQuote: { price: 8250 } as never,
        toast,
      })
    );

    await act(async () => {
      await result.current.onSubmit({
        serviceType: 'pickup',
      } as never);
    });

    expect(toast).toHaveBeenCalledWith({
      description:
        'Your repair request was saved, but payment could not start. Use your ticket to retry shortly. Ticket #42.',
      title: 'Submission Failed',
      variant: 'destructive',
    });
  });
});

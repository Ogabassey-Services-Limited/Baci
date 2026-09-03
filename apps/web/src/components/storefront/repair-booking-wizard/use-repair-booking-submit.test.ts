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
});

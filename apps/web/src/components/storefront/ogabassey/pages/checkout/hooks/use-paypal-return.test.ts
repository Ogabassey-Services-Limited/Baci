import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaypalReturn } from './use-paypal-return';

const capturePaypalReturn = vi.fn();
const toast = vi.fn();

vi.mock('@/lib/paypal-checkout-client', () => ({
  capturePaypalReturn: (...args: unknown[]) => capturePaypalReturn(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => toast(...args),
}));

function setLocationSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { search },
  });
}

function baseParams() {
  return {
    merchantId: 'merchant-1',
    getHref: (path: string) => `/store${path}`,
    routerPush: vi.fn(),
    clearCart: vi.fn(),
    clearCheckoutSession: vi.fn(),
    setIsProcessing: vi.fn(),
  };
}

describe('usePaypalReturn', () => {
  beforeEach(() => {
    capturePaypalReturn.mockReset();
    toast.mockReset();
  });

  afterEach(() => {
    setLocationSearch('');
  });

  it('does nothing when there is no PayPal marker in the URL', () => {
    setLocationSearch('?step=payment');
    const params = baseParams();

    renderHook(() => usePaypalReturn(params));

    expect(capturePaypalReturn).not.toHaveBeenCalled();
    expect(params.setIsProcessing).not.toHaveBeenCalled();
  });

  it('routes to the success page after a captured payment', async () => {
    setLocationSearch('?paypal_return=1&token=PP-1');
    capturePaypalReturn.mockResolvedValueOnce({
      status: 'captured',
      orderId: 'order-1',
      trackingToken: 'trk-1',
    });
    const params = baseParams();

    renderHook(() => usePaypalReturn(params));

    await waitFor(() => {
      expect(params.routerPush).toHaveBeenCalledWith(
        '/store/order-success?type=paypal&orderId=order-1&trackingToken=trk-1'
      );
    });
    expect(params.clearCheckoutSession).toHaveBeenCalled();
    expect(params.clearCart).toHaveBeenCalled();
  });

  it('shows a destructive toast and clears processing on capture error', async () => {
    setLocationSearch('?paypal_return=1&token=PP-1');
    capturePaypalReturn.mockResolvedValueOnce({
      status: 'error',
      message: 'PayPal environment mismatch',
    });
    const params = baseParams();

    renderHook(() => usePaypalReturn(params));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'PayPal payment failed' })
      );
    });
    expect(params.routerPush).not.toHaveBeenCalled();
    expect(params.setIsProcessing).toHaveBeenLastCalledWith(false);
  });

  it('shows a cancellation toast on paypal_cancel', async () => {
    setLocationSearch('?paypal_cancel=1');
    capturePaypalReturn.mockResolvedValueOnce({ status: 'cancelled' });
    const params = baseParams();

    renderHook(() => usePaypalReturn(params));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'PayPal payment cancelled' })
      );
    });
    expect(params.routerPush).not.toHaveBeenCalled();
  });
});

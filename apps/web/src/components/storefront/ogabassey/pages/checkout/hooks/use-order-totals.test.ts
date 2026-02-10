import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOrderTotals } from './use-order-totals';
import { calculateCommerce } from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({
  calculateCommerce: vi.fn(),
}));

describe('useOrderTotals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns null initially', () => {
    vi.mocked(calculateCommerce).mockResolvedValue({ total: 1200, taxAmount: 120 });

    const { result } = renderHook(() =>
      useOrderTotals({ cartTotal: 1000, deliveryCost: 80, taxRate: 0.12 })
    );

    expect(result.current).toBeNull();
  });

  it('returns order totals after successful calculateCommerce call', async () => {
    vi.mocked(calculateCommerce).mockResolvedValue({ total: 1200, taxAmount: 120 });

    const { result } = renderHook(() =>
      useOrderTotals({ cartTotal: 1000, deliveryCost: 80, taxRate: 0.12 })
    );

    await waitFor(() => {
      expect(result.current).toEqual({ total: 1200, taxAmount: 120 });
    });

    expect(calculateCommerce).toHaveBeenCalledWith('calculate_order', {
      subtotal: 1000,
      shippingFee: 80,
      taxRate: 0.12,
    });
  });

  it('returns null and logs error when calculateCommerce throws', async () => {
    const error = new Error('RPC failed');
    vi.mocked(calculateCommerce).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useOrderTotals({ cartTotal: 1000, deliveryCost: 80, taxRate: 0.12 })
    );

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Failed to fetch totals from brain', error);
    });

    expect(result.current).toBeNull();
  });

  it('re-fetches when cartTotal changes', async () => {
    vi.mocked(calculateCommerce).mockResolvedValue({ total: 1200, taxAmount: 120 });

    const { result, rerender } = renderHook(
      ({ cartTotal, deliveryCost, taxRate }) =>
        useOrderTotals({ cartTotal, deliveryCost, taxRate }),
      { initialProps: { cartTotal: 1000, deliveryCost: 80, taxRate: 0.12 } }
    );

    await waitFor(() => expect(result.current).toEqual({ total: 1200, taxAmount: 120 }));

    vi.mocked(calculateCommerce).mockResolvedValue({ total: 2400, taxAmount: 240 });
    rerender({ cartTotal: 2000, deliveryCost: 80, taxRate: 0.12 });

    await waitFor(() => {
      expect(result.current).toEqual({ total: 2400, taxAmount: 240 });
    });

    expect(calculateCommerce).toHaveBeenCalledTimes(2);
    expect(calculateCommerce).toHaveBeenLastCalledWith('calculate_order', {
      subtotal: 2000,
      shippingFee: 80,
      taxRate: 0.12,
    });
  });

  it('re-fetches when deliveryCost changes', async () => {
    vi.mocked(calculateCommerce).mockResolvedValue({ total: 1200, taxAmount: 120 });

    const { result, rerender } = renderHook(
      ({ cartTotal, deliveryCost, taxRate }) =>
        useOrderTotals({ cartTotal, deliveryCost, taxRate }),
      { initialProps: { cartTotal: 1000, deliveryCost: 80, taxRate: 0.12 } }
    );

    await waitFor(() => expect(result.current).toEqual({ total: 1200, taxAmount: 120 }));

    vi.mocked(calculateCommerce).mockResolvedValue({ total: 1320, taxAmount: 120 });
    rerender({ cartTotal: 1000, deliveryCost: 200, taxRate: 0.12 });

    await waitFor(() => expect(calculateCommerce).toHaveBeenCalledTimes(2));
  });

  it('re-fetches when taxRate changes', async () => {
    vi.mocked(calculateCommerce).mockResolvedValue({ total: 1200, taxAmount: 120 });

    const { result, rerender } = renderHook(
      ({ cartTotal, deliveryCost, taxRate }) =>
        useOrderTotals({ cartTotal, deliveryCost, taxRate }),
      { initialProps: { cartTotal: 1000, deliveryCost: 80, taxRate: 0.12 } }
    );

    await waitFor(() => expect(result.current).toEqual({ total: 1200, taxAmount: 120 }));

    vi.mocked(calculateCommerce).mockResolvedValue({ total: 1296, taxAmount: 216 });
    rerender({ cartTotal: 1000, deliveryCost: 80, taxRate: 0.20 });

    await waitFor(() => expect(calculateCommerce).toHaveBeenCalledTimes(2));
  });
});

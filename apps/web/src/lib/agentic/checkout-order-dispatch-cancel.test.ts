import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { markAgenticCheckoutOrderCanceled } from '@/lib/agentic/checkout-order-dispatch';

describe('markAgenticCheckoutOrderCanceled', () => {
  it('marks an order canceled with merchant scoping after finalization failure', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: 'order-1' }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const secondEq = vi.fn(() => ({ select }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const update = vi.fn(() => ({ eq: firstEq }));
    const from = vi.fn(() => ({ update }));

    const result = await markAgenticCheckoutOrderCanceled({
      merchantId: 'merchant-1',
      orderId: 'order-1',
      sessionId: 'agentic_session_1',
      supabase: { from } as unknown as SupabaseClient,
    });

    expect(result.error).toBeNull();
    expect(result.updated).toBe(true);
    expect(from).toHaveBeenCalledWith('orders');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_status: 'cancelled',
        shipping_status: 'cancelled',
      })
    );
    expect(firstEq).toHaveBeenCalledWith('id', 'order-1');
    expect(secondEq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(select).toHaveBeenCalledWith('id');
  });

  it('reports when canceling an order matched no rows', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const secondEq = vi.fn(() => ({ select }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const update = vi.fn(() => ({ eq: firstEq }));
    const from = vi.fn(() => ({ update }));

    const result = await markAgenticCheckoutOrderCanceled({
      merchantId: 'merchant-1',
      orderId: 'order-1',
      sessionId: 'agentic_session_1',
      supabase: { from } as unknown as SupabaseClient,
    });

    expect(result).toEqual({ error: null, updated: false });
  });

  it('returns Supabase errors from order cancellation updates', async () => {
    const cancelError = { message: 'cancel failed' };
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: cancelError });
    const select = vi.fn(() => ({ maybeSingle }));
    const secondEq = vi.fn(() => ({ select }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const update = vi.fn(() => ({ eq: firstEq }));
    const from = vi.fn(() => ({ update }));

    const result = await markAgenticCheckoutOrderCanceled({
      merchantId: 'merchant-1',
      orderId: 'order-1',
      sessionId: 'agentic_session_1',
      supabase: { from } as unknown as SupabaseClient,
    });

    expect(result).toEqual({ error: cancelError, updated: false });
  });
});

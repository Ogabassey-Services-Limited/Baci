import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { POST as createOrder } from '@/app/api/orders/route';
import {
  createAgenticCheckoutOrder,
  markAgenticCheckoutOrderCanceled,
  sendAgenticOrderCreatedWebhook,
} from '@/lib/agentic/checkout-order-dispatch';
import { sendAgenticWebhook } from '@/lib/agentic/webhooks';
import { logger } from '@/lib/logger';

vi.mock('@/app/api/orders/route', () => ({
  POST: vi.fn(),
}));

vi.mock('@/lib/agentic/webhooks', () => ({
  sendAgenticWebhook: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

describe('agentic checkout order dispatch', () => {
  it('creates an internal order request and returns the order id', async () => {
    vi.mocked(createOrder).mockResolvedValue(
      NextResponse.json(
        { order: { id: 'order-1' }, wallet: null, amountDueToGateway: 0 },
        { status: 201 }
      )
    );

    const result = await createAgenticCheckoutOrder({
      merchant_id: 'merchant-1',
    });

    expect(result).toMatchObject({
      ok: true,
      orderId: 'order-1',
      status: 201,
    });
    const request = vi.mocked(createOrder).mock.calls[0]?.[0];
    expect(request?.nextUrl.pathname).toBe('/api/orders');
    expect(request?.nextUrl.hostname).toBe('internal.baci');
    expect(request?.headers.get('x-agentic-internal')).toBe('true');
  });

  it('returns the order API error without creating a false success', async () => {
    vi.mocked(createOrder).mockResolvedValue(
      NextResponse.json({ error: 'inventory changed' }, { status: 409 })
    );

    const result = await createAgenticCheckoutOrder({
      merchant_id: 'merchant-1',
    });

    expect(result).toMatchObject({
      error: 'inventory changed',
      ok: false,
      orderId: undefined,
      status: 409,
    });
  });

  it('sends the agentic order-created webhook asynchronously', () => {
    sendAgenticOrderCreatedWebhook({
      buyer: {
        email: 'buyer@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone_number: '+2348012345678',
      },
      currency: 'NGN',
      orderId: 'order-1',
      sessionId: 'agentic_session_1',
      total: 500000,
    });

    expect(sendAgenticWebhook).toHaveBeenCalledWith(
      'order.created',
      expect.objectContaining({
        id: 'order-1',
        currency: 'NGN',
        total: 500000,
        buyer: expect.objectContaining({
          email: 'buyer@example.com',
        }),
      })
    );
  });

  it('logs webhook delivery failures without throwing synchronously', async () => {
    const error = new Error('webhook offline');
    vi.mocked(sendAgenticWebhook).mockRejectedValue(error);

    expect(() =>
      sendAgenticOrderCreatedWebhook({
        buyer: {
          email: 'buyer@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          phone_number: '+2348012345678',
        },
        currency: 'NGN',
        orderId: 'order-1',
        sessionId: 'agentic_session_1',
        total: 500000,
      })
    ).not.toThrow();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        message: 'Webhook trigger failed',
        sessionId: 'agentic_session_1',
      })
    );
  });

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

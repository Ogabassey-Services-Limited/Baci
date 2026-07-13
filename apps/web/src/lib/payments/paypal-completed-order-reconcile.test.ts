import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcileCompletedPaypalOrderForCreate } from './paypal-completed-order-reconcile';
import { runPaypalReconcileFunnel } from './paypal-settlement-funnel';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('./paypal-settlement-funnel', () => ({
  runPaypalReconcileFunnel: vi.fn(),
}));

const MERCHANT_ID = 'm1';
const ORDER_ID = 'o1';
const PAYPAL_ORDER_ID = 'PP-1';

const supabase = {} as unknown as SupabaseClient;

function input() {
  return {
    merchantId: MERCHANT_ID,
    orderId: ORDER_ID,
    paypalOrderId: PAYPAL_ORDER_ID,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * This guard used to re-implement validate → flip → settle, which is how it
 * drifted from the capture route (it never checked residual freshness, and it
 * settled anyway after a failed transaction write). It now delegates to the one
 * settlement funnel, so the contract worth testing here is THAT it delegates —
 * the funnel's own suite covers the decisions themselves.
 */
describe('reconcileCompletedPaypalOrderForCreate', () => {
  it('delegates the captured order to the single settlement funnel', async () => {
    vi.mocked(runPaypalReconcileFunnel).mockResolvedValue({
      ok: true,
      response: NextResponse.json({ success: true }),
    });

    await reconcileCompletedPaypalOrderForCreate(supabase, input());

    expect(runPaypalReconcileFunnel).toHaveBeenCalledTimes(1);
    expect(runPaypalReconcileFunnel).toHaveBeenCalledWith(supabase, {
      merchantId: MERCHANT_ID,
      orderId: ORDER_ID,
      paypalOrderId: PAYPAL_ORDER_ID,
    });
  });

  it('does not throw when the funnel cannot load the context (the route still blocks the retry)', async () => {
    vi.mocked(runPaypalReconcileFunnel).mockResolvedValue({
      ok: false,
      status: 404,
      body: { error: 'Transaction not found for this reference' },
    });

    await expect(
      reconcileCompletedPaypalOrderForCreate(supabase, input())
    ).resolves.toBeUndefined();
  });

  it('does not throw when the funnel declines to settle (e.g. a rejected stale amount)', async () => {
    vi.mocked(runPaypalReconcileFunnel).mockResolvedValue({
      ok: true,
      response: NextResponse.json(
        { error: 'The order total changed', code: 'PAYPAL_AMOUNT_STALE' },
        { status: 409 }
      ),
    });

    await expect(
      reconcileCompletedPaypalOrderForCreate(supabase, input())
    ).resolves.toBeUndefined();
  });
});

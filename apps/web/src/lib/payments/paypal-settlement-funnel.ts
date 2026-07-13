import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { loadPaypalCaptureContext } from '@/lib/payments/load-paypal-capture-context';
import {
  buildPaypalCaptureState,
  type PaypalCaptureContext,
} from '@/lib/payments/paypal-capture-execute';
import {
  mapPaypalOrderStatus,
  needsPaypalStatusLookup,
  type PaypalOrderStatus,
  resolvePaypalCaptureOutcome,
} from '@/lib/payments/paypal-capture-outcome';
import { handlePaypalCaptureOutcome } from '@/lib/payments/paypal-capture-outcome-handlers';
import {
  getPaypalCheckoutCredentials,
  readPaypalFeatureConfig,
} from '@/lib/payments/paypal-checkout-credentials';
import { getOrder, type PayPalOrderDetails } from '@/lib/paypal';

/**
 * THE single entry point for "what should happen to this PayPal capture?".
 *
 * Every caller that can settle, block, refund or reject a PayPal payment — the
 * capture route, `/verify`, and the create-order reconcile guards — goes through
 * here. Before this existed each of those re-derived the decision from its own
 * subset of state, so a fix applied to one silently missed the others (the
 * residual-freshness check and the post-capture failure handling both existed in
 * one path and not the others). The decision now lives in exactly one place:
 * `resolvePaypalCaptureOutcome` decides, `handlePaypalCaptureOutcome` acts.
 *
 * `intent` is the only thing that varies:
 *  - `capture`         — the capture route may actually charge the buyer.
 *  - `reconcile_only`  — /verify and create-order may NEVER charge. They exist to
 *                        reconcile money PayPal already took, so a resolver that
 *                        says "capturable" means "nothing was captured", and the
 *                        caller is told so instead of a charge being issued.
 */
export type PaypalSettlementIntent = 'capture' | 'reconcile_only';

/**
 * Resolves the live PayPal status, applies the resolver, and dispatches. Assumes
 * the caller already built a context (the capture route does; the helpers below
 * build one for the reconcile-only callers).
 */
export async function resolveAndDispatchPaypalSettlement(
  ctx: PaypalCaptureContext,
  intent: PaypalSettlementIntent
): Promise<NextResponse> {
  let remote: PayPalOrderDetails | undefined;
  let paypalOrderStatus: PaypalOrderStatus;

  if (ctx.transaction.status === 'completed') {
    // The capture response is already persisted — PayPal took the money.
    paypalOrderStatus = 'COMPLETED';
  } else if (
    intent === 'reconcile_only' ||
    needsPaypalStatusLookup(
      ctx.orderSnapshot.payment_status,
      ctx.orderSnapshot.shipping_status
    )
  ) {
    // A reconcile-only caller ALWAYS looks up: it cannot capture, so guessing
    // `APPROVED` would be a lie it can never correct. A settled/cancelled order
    // is looked up so we know whether a stale order captured behind our back.
    const fetched = await getOrder(
      ctx.credentials.clientId,
      ctx.credentials.secretKey,
      ctx.paypalOrderId,
      ctx.mode
    );
    remote = fetched.success ? fetched.data : undefined;
    paypalOrderStatus = fetched.success
      ? mapPaypalOrderStatus(fetched.data.status)
      : 'UNKNOWN';
  } else {
    // Plainly-unpaid order on the capture path: capture optimistically. A lost
    // COMPLETED write surfaces as PayPal's HTTP 422, which re-resolves against
    // the live status rather than charging twice.
    paypalOrderStatus = 'APPROVED';
  }

  const outcome = resolvePaypalCaptureOutcome(
    buildPaypalCaptureState(ctx, paypalOrderStatus)
  );

  if (intent === 'reconcile_only' && outcome.kind === 'capture_then_finalize') {
    // The order is still capturable, i.e. PayPal never took the money. There is
    // nothing to reconcile and this caller must not charge.
    return NextResponse.json(
      {
        error: 'PayPal has not captured this order',
        code: 'PAYPAL_NOT_CAPTURED',
      },
      { status: 409 }
    );
  }

  return handlePaypalCaptureOutcome(ctx, outcome, remote);
}

export type PaypalSettlementFunnelResult =
  | { ok: true; response: NextResponse }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Builds the context a reconcile-only caller needs (loading the transaction,
 * order snapshot, residuals and presentment through the SAME loader the capture
 * route uses) and runs the funnel. Callers that already hold a context — the
 * capture route — should call `resolveAndDispatchPaypalSettlement` directly.
 */
export async function runPaypalReconcileFunnel(
  supabase: SupabaseClient,
  input: {
    merchantId: string;
    orderId: string;
    paypalOrderId: string;
  }
): Promise<PaypalSettlementFunnelResult> {
  const { merchantId, orderId, paypalOrderId } = input;

  // Reconcile-only callers are internal and have already established which order
  // they are acting on (the create-order route validated it; /verify looked the
  // transaction up by its gateway reference). They therefore omit the
  // customer-email guard, which exists to stop a CAPTURE request from being
  // pointed at someone else's order.
  const load = await loadPaypalCaptureContext(supabase, {
    orderId,
    paypalOrderId,
    merchantId,
  });
  if (!load.ok) {
    return { ok: false, status: load.status, body: load.body };
  }

  // Resolve the store's PayPal mode here so no reconcile-only caller has to
  // thread it through (and none can get it wrong).
  const { data: featureSettings } = await supabase
    .from('merchant_feature_settings')
    .select('custom_settings')
    .eq('merchant_id', merchantId)
    .maybeSingle();
  const { mode, environment } = readPaypalFeatureConfig(
    featureSettings?.custom_settings as Record<string, unknown> | null
  );

  const credentials = await getPaypalCheckoutCredentials(
    merchantId,
    environment
  );
  if (!credentials) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'PayPal is not configured for this store',
        code: 'PAYPAL_NOT_CONFIGURED',
      },
    };
  }

  const ctx: PaypalCaptureContext = {
    supabase,
    merchantId,
    orderId,
    paypalOrderId,
    environment,
    mode,
    credentials,
    transaction: load.transaction,
    orderSnapshot: load.orderSnapshot,
    orderTotal: Number(load.orderSnapshot.total),
    lockedResidual: load.lockedResidual,
    currentResidual: load.currentResidual,
    presentmentAmount: load.presentmentAmount,
    presentmentCurrency: load.presentmentCurrency,
  };

  return {
    ok: true,
    response: await resolveAndDispatchPaypalSettlement(ctx, 'reconcile_only'),
  };
}

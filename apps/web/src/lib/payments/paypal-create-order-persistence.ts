import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import type { PaymentCredentialEnvironment } from '@/lib/payments/merchant-credentials';
import {
  isPaypalAuthFailure,
  markPaypalCredentialInvalid,
} from '@/lib/payments/paypal-checkout-credentials';
import { createOrder, type PayPalMode } from '@/lib/paypal';

/**
 * Persistence for the PayPal BYOK create-order route, split out to keep the
 * route under the 300-line cap and independently testable (Wave 2, see
 * docs/payments/byok-payment-providers-plan.md Phase 2).
 */

interface PaypalPendingTransactionParams {
  existingTransaction: {
    gateway_reference?: string | null;
    metadata?: unknown;
  } | null;
  merchantId: string;
  orderId: string;
  customerEmail: string;
  amount: number;
  currency: string;
  mode: PayPalMode;
  paypalOrderId: string;
  presentmentAmount: number;
  presentmentCurrency: string;
  fxRate: number;
}

/**
 * Persists the pending PayPal `transactions` row for a create-order attempt.
 *
 * When a prior pending row already exists for this order (a cancel/retry whose
 * stored PayPal order is dead, or a presentment that moved), it is repointed at
 * the fresh PayPal order in place — never a second pending row, which would make
 * the later `.maybeSingle()` reuse lookup throw. Otherwise a new row is created
 * via `create_payment_transaction`. Records the residual (order-currency) amount
 * so a wallet/savings-composed order is not charged/booked for the full total.
 */
export async function persistPaypalPendingTransaction(
  supabase: SupabaseClient,
  params: PaypalPendingTransactionParams
): Promise<{ error: unknown }> {
  const presentmentMetadata = {
    order_id: params.orderId,
    paypal_mode: params.mode,
    paypal_presentment_amount: params.presentmentAmount,
    paypal_presentment_currency: params.presentmentCurrency,
    paypal_fx_rate: params.fxRate,
  };

  if (params.existingTransaction?.gateway_reference) {
    const existingMetadata =
      (params.existingTransaction.metadata as Record<string, unknown> | null) ??
      {};
    const { error } = await supabase
      .from('transactions')
      .update({
        gateway_reference: params.paypalOrderId,
        amount: params.amount,
        merchant_amount: params.amount,
        metadata: { ...existingMetadata, ...presentmentMetadata },
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', params.orderId)
      .eq('merchant_id', params.merchantId)
      .eq('gateway', 'paypal')
      .eq('status', 'pending');
    return { error };
  }

  const { error } = await supabase.rpc('create_payment_transaction', {
    p_merchant_id: params.merchantId,
    p_order_id: params.orderId,
    p_amount: params.amount,
    p_currency: params.currency,
    p_gateway: 'paypal',
    p_reference: params.paypalOrderId,
    p_platform_fee: 0,
    p_merchant_amount: params.amount,
    p_customer_email: params.customerEmail,
    p_customer_name: null,
    p_session_id: null,
    p_metadata: presentmentMetadata,
  });
  return { error };
}

export type CreateAndPersistPaypalResult =
  | { ok: true; id: string; approveUrl?: string }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Creates a fresh PayPal order for the residual presentment and persists the
 * pending transaction row. A PayPal 401 disables the stored credential (Phase 2
 * item 1); every failure is returned as a ready-to-send `{ status, body }` so
 * the route stays thin. The platform fee is 0 — money settles directly to the
 * merchant's own PayPal account. The BYOK fee-accrual row is written on a
 * successful capture, not here (F8).
 */
export async function createAndPersistPaypalOrder(
  supabase: SupabaseClient,
  params: {
    credentials: { clientId: string; secretKey: string };
    environment: PaymentCredentialEnvironment;
    merchantId: string;
    orderId: string;
    customerEmail: string;
    orderCurrency: string;
    residualAmount: number;
    presentmentAmount: number;
    presentmentCurrency: string;
    fxRate: number;
    trackingToken: string;
    mode: PayPalMode;
    returnUrl?: string;
    cancelUrl?: string;
    existingTransaction: {
      gateway_reference?: string | null;
      metadata?: unknown;
    } | null;
  }
): Promise<CreateAndPersistPaypalResult> {
  const created = await createOrder(
    params.credentials.clientId,
    params.credentials.secretKey,
    params.presentmentAmount,
    params.presentmentCurrency,
    params.trackingToken,
    params.mode,
    { returnUrl: params.returnUrl, cancelUrl: params.cancelUrl }
  );

  if (!created.success) {
    if (isPaypalAuthFailure(created.code)) {
      await markPaypalCredentialInvalid(
        params.merchantId,
        params.environment,
        created.error
      );
      return {
        ok: false,
        status: 400,
        body: {
          error: 'PayPal rejected the store credentials',
          code: 'INVALID_PROVIDER_CREDENTIALS',
        },
      };
    }
    return {
      ok: false,
      status: 500,
      body: { error: created.error, code: created.code },
    };
  }

  const paypalOrderId = created.data.id;

  const { error } = await persistPaypalPendingTransaction(supabase, {
    existingTransaction: params.existingTransaction,
    merchantId: params.merchantId,
    orderId: params.orderId,
    customerEmail: params.customerEmail,
    amount: params.residualAmount,
    currency: params.orderCurrency,
    mode: params.mode,
    paypalOrderId,
    presentmentAmount: params.presentmentAmount,
    presentmentCurrency: params.presentmentCurrency,
    fxRate: params.fxRate,
  });

  if (error) {
    logger.error({
      message: 'Failed to persist pending PayPal transaction record',
      error,
    });
    return {
      ok: false,
      status: 500,
      body: { error: 'Failed to record transaction', code: 'DATABASE_ERROR' },
    };
  }

  return { ok: true, id: paypalOrderId, approveUrl: created.data.approveUrl };
}

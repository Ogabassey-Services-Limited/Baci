import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ResolvedPaypalSplit {
  paypalResidualPaid: number;
  prepaidPaid: number;
  savingsAmountUsed: number;
  customerId: string | null;
}

function finiteOrNull(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Resolves the persisted PayPal/prepaid split, failing closed on read errors. */
export async function resolvePaypalSplit(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  transactionMetadata: unknown
): Promise<ResolvedPaypalSplit | { failed: true; reason: string }> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('total, wallet_amount_used, customer_id')
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (orderError || !order) {
    return { failed: true, reason: 'order_lookup_failed' };
  }

  const orderTotal = Number(order.total) || 0;
  const walletAmountUsed = Math.max(Number(order.wallet_amount_used) || 0, 0);
  const customerId = (order.customer_id as string | null) ?? null;

  const { data: savingsRows, error: savingsError } = await supabase
    .from('customer_savings_redemptions')
    .select('amount')
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId);

  if (savingsError) {
    return { failed: true, reason: 'savings_lookup_failed' };
  }

  const savingsAmountUsed = Array.isArray(savingsRows)
    ? savingsRows.reduce(
        (sum, row) => sum + Math.max(Number(row?.amount) || 0, 0),
        0
      )
    : 0;

  const metadata =
    (transactionMetadata as Record<string, unknown> | null) ?? {};
  const storedSplit = metadata.paypal_split as
    | { paypalResidualPaid?: unknown; prepaidPaid?: unknown }
    | undefined;
  const storedResidual = finiteOrNull(storedSplit?.paypalResidualPaid);
  const storedPrepaid = finiteOrNull(storedSplit?.prepaidPaid);

  if (storedResidual !== null && storedPrepaid !== null) {
    return {
      paypalResidualPaid: storedResidual,
      prepaidPaid: storedPrepaid,
      savingsAmountUsed,
      customerId,
    };
  }

  const prepaidPaid = walletAmountUsed + savingsAmountUsed;
  return {
    paypalResidualPaid: Math.max(orderTotal - prepaidPaid, 0),
    prepaidPaid,
    savingsAmountUsed,
    customerId,
  };
}

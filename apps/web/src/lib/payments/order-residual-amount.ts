import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Computes the amount that still has to be charged to a payment gateway for an
 * order after any Baci-side tender (wallet credit + redeemed customer savings)
 * has been applied. Mirrors the residual logic in the payments/initialize route
 * (`payableAmount = total - wallet_amount_used - savings`) so every gateway lane
 * — including the PayPal BYOK lane — charges the buyer only the outstanding
 * balance instead of the full order total.
 *
 * Returns a discriminated result so the caller can distinguish a wallet lookup
 * failure from a savings lookup failure and map each to its own error code.
 */

export type OrderResidualResult =
  | {
      ok: true;
      walletAmountUsed: number;
      savingsAmountUsed: number;
      residualAmount: number;
    }
  | { ok: false; reason: 'wallet_lookup_failed' | 'savings_lookup_failed' };

function toNonNegativeNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function computeOrderResidualAmount(
  supabase: SupabaseClient,
  {
    orderId,
    merchantId,
    orderTotal,
  }: { orderId: string; merchantId: string; orderTotal: number }
): Promise<OrderResidualResult> {
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('wallet_amount_used')
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (orderError || !orderRow) {
    return { ok: false, reason: 'wallet_lookup_failed' };
  }

  const walletAmountUsed = toNonNegativeNumber(
    (orderRow as { wallet_amount_used?: unknown }).wallet_amount_used
  );

  const { data: savingsRows, error: savingsError } = await supabase
    .from('customer_savings_redemptions')
    .select('amount')
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId);

  if (savingsError) {
    return { ok: false, reason: 'savings_lookup_failed' };
  }

  const savingsAmountUsed = Array.isArray(savingsRows)
    ? savingsRows.reduce(
        (sum, row) =>
          sum +
          toNonNegativeNumber(
            row && typeof row === 'object'
              ? (row as { amount?: unknown }).amount
              : 0
          ),
        0
      )
    : 0;

  const residualAmount = Math.max(
    orderTotal - walletAmountUsed - savingsAmountUsed,
    0
  );

  return { ok: true, walletAmountUsed, savingsAmountUsed, residualAmount };
}

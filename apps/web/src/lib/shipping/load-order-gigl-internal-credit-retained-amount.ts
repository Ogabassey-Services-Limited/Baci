import type { SupabaseClient } from '@supabase/supabase-js';

const INTERNAL_CREDIT_GATEWAYS = ['wallet', 'savings', 'store_credit'] as const;

export type ProjectedGiglCheckoutRetention = {
  shipping_funding_source?: 'customer_checkout' | 'merchant_wallet' | null;
  shipping_platform_retained_amount?: number | string | null;
};

function parseRetainedShippingAmount(
  value: number | string | null | undefined
): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed)
    ? Math.max(0, parsed)
    : 0;
}

function sumAmountRows(
  rows: unknown,
  readAmount: (
    row: Record<string, unknown>
  ) => number | string | null | undefined
): number {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => {
    if (!row || typeof row !== 'object') return sum;
    return (
      sum +
      parseRetainedShippingAmount(readAmount(row as Record<string, unknown>))
    );
  }, 0);
}

async function loadCompletedInternalCreditTransactions(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('transactions')
    .select('gateway, status, amount')
    .eq('merchant_id', merchantId)
    .eq('order_id', orderId)
    .eq('status', 'completed')
    .in('gateway', [...INTERNAL_CREDIT_GATEWAYS]);

  if (error) {
    throw new Error(
      `Failed to load internal-credit GIGL retention: ${error.message}`
    );
  }

  return sumAmountRows(data, (row) => {
    const gateway =
      typeof row.gateway === 'string' ? row.gateway.trim().toLowerCase() : '';
    if (!(INTERNAL_CREDIT_GATEWAYS as readonly string[]).includes(gateway)) {
      return 0;
    }
    return row.amount as number | string | null | undefined;
  });
}

async function loadWalletOrderRedemptionAmount(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('customer_wallet_transactions')
    .select('amount, status, source_type, source_id')
    .eq('merchant_id', merchantId)
    .eq('source_type', 'order_redemption')
    .eq('source_id', orderId)
    .eq('status', 'completed');

  if (error) {
    throw new Error(
      `Failed to load wallet redemption GIGL retention: ${error.message}`
    );
  }

  return sumAmountRows(data, (row) => {
    if (row.source_type !== 'order_redemption' || row.source_id !== orderId) {
      return 0;
    }
    if (row.status !== 'completed') return 0;
    return row.amount as number | string | null | undefined;
  });
}

async function loadSavingsOrderRedemptionAmount(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('customer_savings_redemptions')
    .select('amount, order_id, metadata')
    .eq('merchant_id', merchantId)
    .eq('order_id', orderId);

  if (error) {
    throw new Error(
      `Failed to load savings redemption GIGL retention: ${error.message}`
    );
  }

  return sumAmountRows(data, (row) => {
    if (row.order_id !== orderId) return 0;
    const metadata =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : null;
    if (metadata && typeof metadata.reversed_at === 'string') {
      return 0;
    }
    return row.amount as number | string | null | undefined;
  });
}

/**
 * Customer wallet / savings / store-credit checkouts never create
 * merchant_settlements retention rows the way Paystack does. Sum completed
 * internal-credit transaction amounts plus order-scoped redemption ledgers
 * (partial mixed-credit checkouts never finalize into `transactions`);
 * callers combine this with settlement retention and cap at the tariff.
 *
 * Ledger and transaction rows can both exist after full-credit finalize, so
 * the returned evidence is the max of the two sources (not their sum).
 */
export async function loadOrderGiglInternalCreditRetainedAmount(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  projectedRetention: ProjectedGiglCheckoutRetention
): Promise<number> {
  if (typeof supabase.from !== 'function') {
    throw new Error(
      'Internal-credit retention lookup requires a Supabase client.'
    );
  }

  if (projectedRetention.shipping_funding_source !== 'customer_checkout') {
    return 0;
  }

  const [fromTransactions, fromWalletLedger, fromSavingsLedger] =
    await Promise.all([
      loadCompletedInternalCreditTransactions(supabase, merchantId, orderId),
      loadWalletOrderRedemptionAmount(supabase, merchantId, orderId),
      loadSavingsOrderRedemptionAmount(supabase, merchantId, orderId),
    ]);

  const fromLedgers = fromWalletLedger + fromSavingsLedger;
  return Math.max(fromTransactions, fromLedgers);
}

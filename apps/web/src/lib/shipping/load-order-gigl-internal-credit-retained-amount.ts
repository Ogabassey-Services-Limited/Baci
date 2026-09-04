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

/**
 * Customer wallet / savings / store-credit checkouts never create
 * merchant_settlements retention rows the way Paystack does. Sum completed
 * internal-credit transaction amounts as the portion Baci already controls;
 * callers combine this with settlement retention and cap at the tariff.
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

  const { data: transactions, error: transactionsError } = await supabase
    .from('transactions')
    .select('gateway, status, amount')
    .eq('merchant_id', merchantId)
    .eq('order_id', orderId)
    .eq('status', 'completed')
    .in('gateway', [...INTERNAL_CREDIT_GATEWAYS]);

  if (transactionsError) {
    throw new Error(
      `Failed to load internal-credit GIGL retention: ${transactionsError.message}`
    );
  }

  const rows = Array.isArray(transactions) ? transactions : [];
  return rows.reduce((sum, row) => {
    if (!row || typeof row !== 'object') return sum;
    const gateway =
      'gateway' in row && typeof row.gateway === 'string'
        ? row.gateway.trim().toLowerCase()
        : '';
    if (!(INTERNAL_CREDIT_GATEWAYS as readonly string[]).includes(gateway)) {
      return sum;
    }
    const amount = parseRetainedShippingAmount(
      'amount' in row
        ? (row.amount as number | string | null | undefined)
        : null
    );
    return sum + amount;
  }, 0);
}

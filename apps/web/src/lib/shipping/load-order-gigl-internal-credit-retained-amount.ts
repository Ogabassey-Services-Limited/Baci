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
 * merchant_settlements retention rows the way Paystack does. A completed
 * internal-credit transaction proves Baci already controls that paid portion;
 * reuse the already-projected checkout retention instead of re-selecting
 * revoked orders.shipping_platform_retained_amount.
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

  const { data: transactions, error: transactionsError } = await supabase
    .from('transactions')
    .select('gateway, status')
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
  const hasInternalCredit = rows.some((row) => {
    if (!row || typeof row !== 'object') return false;
    const gateway =
      'gateway' in row && typeof row.gateway === 'string'
        ? row.gateway.trim().toLowerCase()
        : '';
    return (INTERNAL_CREDIT_GATEWAYS as readonly string[]).includes(gateway);
  });

  if (!hasInternalCredit) {
    return 0;
  }

  if (projectedRetention.shipping_funding_source !== 'customer_checkout') {
    return 0;
  }

  return parseRetainedShippingAmount(
    projectedRetention.shipping_platform_retained_amount
  );
}

import type { SupabaseClient } from '@supabase/supabase-js';

function parseRetainedShippingAmount(metadata: unknown): number {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return 0;
  }

  const retained = Number(
    (metadata as { retained_shipping_amount?: unknown })
      .retained_shipping_amount ?? 0
  );
  return Number.isFinite(retained) ? Math.max(0, retained) : 0;
}

/**
 * Cumulative GIGL shipping retention actually settled for an order. Mirrors
 * record_merchant_settlement_gigl_v1: sum metadata.retained_shipping_amount
 * across non-cancelled merchant_settlements for the order.
 */
export async function loadOrderGiglSettledRetainedAmount(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string
): Promise<number> {
  if (typeof supabase.from !== 'function') {
    throw new Error('Settlement retention lookup requires a Supabase client.');
  }

  const { data, error } = await supabase
    .from('merchant_settlements')
    .select('metadata, status')
    .eq('merchant_id', merchantId)
    .eq('source_type', 'order')
    .eq('source_id', orderId);

  if (error) {
    throw new Error(`Failed to load settled GIGL retention: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.reduce((sum, row) => {
    if (!row || typeof row !== 'object') return sum;
    const status =
      'status' in row && typeof row.status === 'string' ? row.status : null;
    // Match SQL: status IS DISTINCT FROM 'cancelled' (null status counts).
    if (status === 'cancelled') return sum;
    return (
      sum + parseRetainedShippingAmount('metadata' in row ? row.metadata : null)
    );
  }, 0);
}

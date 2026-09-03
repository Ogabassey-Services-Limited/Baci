import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { toShippingQuoteUpsert } from '@/app/api/shipping/quotes/shipping-quote-persistence';
import type { QuoteRequest, ShippingQuote } from '@/lib/shipping/types';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Persist a provider-refreshed quote.
 * - Checkout/book refreshes use the service-role writer so callers cannot forge
 *   quote economics through PostgREST.
 * - Admin wallet refreshes stay on the caller-bound order attestation RPC.
 */
export async function persistRefreshedShippingQuote(
  supabase: SupabaseClient,
  quote: ShippingQuote,
  context: {
    merchantId?: string | null;
    sessionId: string;
    quoteRequest: QuoteRequest;
    /** Order identity for an Admin wallet refresh, bound by the server RPC. */
    orderId?: string;
  }
): Promise<{ error: { code?: string; message?: string } | null }> {
  const persisted = toShippingQuoteUpsert(quote, context);

  if (quote.provider === 'GIGL' && context.orderId && context.merchantId) {
    const { error } = await supabase.rpc(
      'persist_refreshed_order_shipping_quote' as never,
      {
        p_order_id: context.orderId,
        p_quote: persisted,
      } as never
    );
    return { error };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc(
    'persist_refreshed_merchant_shipping_quote' as never,
    { p_quote: persisted } as never
  );
  return { error };
}

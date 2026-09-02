import 'server-only';

import { toShippingQuoteUpsert } from '@/app/api/shipping/quotes/shipping-quote-persistence';
import type { QuoteRequest, ShippingQuote } from '@/lib/shipping/types';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Persist a provider-refreshed quote through the trusted server writer. The
 * authenticated shipping_quotes projection deliberately cannot write pricing
 * economics or provider metadata, while this helper receives only the
 * provider result produced by the server-side quote client.
 */
export async function persistRefreshedShippingQuote(
  quote: ShippingQuote,
  context: {
    merchantId?: string | null;
    sessionId: string;
    quoteRequest: QuoteRequest;
  }
): Promise<{ error: { code?: string; message?: string } | null }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('shipping_quotes')
    .upsert(toShippingQuoteUpsert(quote, context), { onConflict: 'id' });
  return { error };
}

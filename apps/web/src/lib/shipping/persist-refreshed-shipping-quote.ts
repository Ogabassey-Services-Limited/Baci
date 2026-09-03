import 'server-only';

import { toShippingQuoteUpsert } from '@/app/api/shipping/quotes/shipping-quote-persistence';
import type { QuoteRequest, ShippingQuote } from '@/lib/shipping/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { persistAdminGiglQuote } from './persist-admin-gigl-quote';

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
    /**
     * Order identity for an Admin wallet refresh. Admin GIGL quotes are
     * attested to their order before wallet reservation, so a replacement
     * quote must use the trusted attestation writer rather than the ordinary
     * shipping_quotes upsert.
     */
    orderId?: string;
  }
): Promise<{ error: { code?: string; message?: string } | null }> {
  const persisted = toShippingQuoteUpsert(quote, context);

  if (quote.provider === 'GIGL' && context.orderId && context.merchantId) {
    const { error } = await persistAdminGiglQuote({
      quote: persisted,
      attestation: {
        quote_id: quote.id,
        order_id: context.orderId,
        merchant_id: context.merchantId,
        provider_rate_id: quote.providerRateId ?? null,
        quote_request: context.quoteRequest,
      },
    });
    return { error };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('shipping_quotes')
    .upsert(persisted, { onConflict: 'id' });
  return { error };
}

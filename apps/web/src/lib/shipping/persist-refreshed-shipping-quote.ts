import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { toShippingQuoteUpsert } from '@/app/api/shipping/quotes/shipping-quote-persistence';
import type { QuoteRequest, ShippingQuote } from '@/lib/shipping/types';
import { persistAdminGiglQuote } from './persist-admin-gigl-quote';

/**
 * Persist a provider-refreshed quote. Wallet GIGL replacements stay on the
 * attested admin writer; checkout/book refreshes use the merchant-owned RPC
 * so this helper never constructs a service-role client.
 */
export async function persistRefreshedShippingQuote(
  supabase: SupabaseClient,
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

  const { error } = await supabase.rpc(
    'persist_refreshed_merchant_shipping_quote' as never,
    { p_quote: persisted } as never
  );
  return { error };
}

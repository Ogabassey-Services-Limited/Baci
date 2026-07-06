import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderCreateInput } from '@/schemas/orders';
import { parseStoredQuoteRequest } from './order-shipment-booking-utils';
import { GIGL_INTERNATIONAL_PROVIDER_RATE_PREFIX } from './providers/gigl.international-payload';

export type OrderShippingAddressForQuote = NonNullable<
  OrderCreateInput['shipping_address']
>;

type QuoteDestinationRecord = {
  provider_rate_id: string | null;
  quote_request: unknown;
};

export async function enrichShippingAddressWithQuoteDestination(
  supabase: SupabaseClient,
  selectedQuoteId: string | null | undefined,
  shippingAddress: OrderShippingAddressForQuote | undefined
): Promise<OrderShippingAddressForQuote | undefined> {
  if (!selectedQuoteId || !shippingAddress) {
    return shippingAddress;
  }

  const { data: quote } = (await supabase
    .from('shipping_quotes')
    .select('provider_rate_id, quote_request')
    .eq('id', selectedQuoteId)
    .maybeSingle()) as { data: QuoteDestinationRecord | null };

  const isGiglInternationalQuote =
    quote?.provider_rate_id?.startsWith(
      `${GIGL_INTERNATIONAL_PROVIDER_RATE_PREFIX}_`
    ) === true;
  if (!isGiglInternationalQuote) {
    return shippingAddress;
  }

  const quoteRequest = parseStoredQuoteRequest(quote.quote_request);
  if (!quoteRequest) {
    return shippingAddress;
  }

  return {
    ...shippingAddress,
    country: quoteRequest.receiver.country,
    countryCode: quoteRequest.receiver.countryCode,
    postalCode: quoteRequest.receiver.postalCode,
  };
}

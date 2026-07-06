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

export class OrderQuoteDestinationMismatchError extends Error {
  readonly code = 'INTERNATIONAL_QUOTE_DESTINATION_MISMATCH';
  readonly status = 400;

  constructor() {
    super(
      'The saved international shipping quote no longer matches this delivery address. Please get a new quote before checkout.'
    );
    this.name = 'OrderQuoteDestinationMismatchError';
  }
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function matchesOptionalText(
  orderValue: string | null | undefined,
  quoteValue: string | null | undefined
): boolean {
  const normalizedOrderValue = normalizeText(orderValue);
  return (
    normalizedOrderValue.length === 0 ||
    normalizedOrderValue === normalizeText(quoteValue)
  );
}

function matchesQuoteDestination(
  shippingAddress: OrderShippingAddressForQuote,
  quoteRequest: NonNullable<ReturnType<typeof parseStoredQuoteRequest>>
): boolean {
  const receiver = quoteRequest.receiver;
  return (
    normalizeText(shippingAddress.address) ===
      normalizeText(receiver.address) &&
    normalizeText(shippingAddress.city) === normalizeText(receiver.city) &&
    normalizeText(shippingAddress.state) === normalizeText(receiver.state) &&
    matchesOptionalText(shippingAddress.country, receiver.country) &&
    matchesOptionalText(shippingAddress.countryCode, receiver.countryCode) &&
    matchesOptionalText(shippingAddress.postalCode, receiver.postalCode)
  );
}

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

  if (!matchesQuoteDestination(shippingAddress, quoteRequest)) {
    throw new OrderQuoteDestinationMismatchError();
  }

  return {
    ...shippingAddress,
    country: quoteRequest.receiver.country,
    countryCode: quoteRequest.receiver.countryCode,
    postalCode: quoteRequest.receiver.postalCode,
  };
}

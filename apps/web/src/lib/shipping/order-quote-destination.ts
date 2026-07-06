import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderCreateInput } from '@/schemas/orders';
import { parseStoredQuoteRequest } from './order-shipment-booking-utils';
import { GIGL_INTERNATIONAL_PROVIDER_RATE_PREFIX } from './providers/gigl.international-payload';

export type OrderShippingAddressForQuote = NonNullable<
  OrderCreateInput['shipping_address']
>;

type QuoteDestinationRecord = {
  price?: number | string | null;
  provider_rate_id: string | null;
  quote_request: unknown;
};

type CheckoutItemForQuote = OrderCreateInput['items'][number];

type QuoteCheckoutContext = {
  items?: CheckoutItemForQuote[];
  merchantId?: string;
  shippingFee?: number;
};

export class OrderQuoteDestinationMismatchError extends Error {
  readonly status = 400;

  constructor(
    message = 'The saved international shipping quote no longer matches this delivery address. Please get a new quote before checkout.',
    readonly code = 'INTERNATIONAL_QUOTE_DESTINATION_MISMATCH'
  ) {
    super(message);
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

function throwQuoteMismatch(code: string): never {
  throw new OrderQuoteDestinationMismatchError(
    'The saved international shipping quote no longer matches this checkout. Please get a new quote before checkout.',
    code
  );
}

function readComparableItemValue(item: CheckoutItemForQuote): number {
  return item.negotiatedPrice ?? item.value ?? item.price;
}

function matchesQuoteItem(
  checkoutItem: CheckoutItemForQuote,
  quoteItem: NonNullable<
    ReturnType<typeof parseStoredQuoteRequest>
  >['items'][number]
): boolean {
  return (
    normalizeText(checkoutItem.name) === normalizeText(quoteItem.name) &&
    checkoutItem.quantity === quoteItem.quantity &&
    readComparableItemValue(checkoutItem) === quoteItem.value
  );
}

function validateQuoteCheckoutContext(
  quote: QuoteDestinationRecord,
  quoteRequest: NonNullable<ReturnType<typeof parseStoredQuoteRequest>>,
  context: QuoteCheckoutContext
): void {
  if (
    context.merchantId &&
    (!quoteRequest.merchantId || quoteRequest.merchantId !== context.merchantId)
  ) {
    throwQuoteMismatch('INTERNATIONAL_QUOTE_MERCHANT_MISMATCH');
  }

  const quotePrice = Number(quote.price);
  if (
    typeof context.shippingFee === 'number' &&
    Number.isFinite(quotePrice) &&
    context.shippingFee !== quotePrice
  ) {
    throwQuoteMismatch('INTERNATIONAL_QUOTE_ORDER_MISMATCH');
  }

  if (!context.items) return;
  if (context.items.length !== quoteRequest.items.length) {
    throwQuoteMismatch('INTERNATIONAL_QUOTE_ORDER_MISMATCH');
  }

  const unmatchedCheckoutItems = [...context.items];
  for (const quoteItem of quoteRequest.items) {
    const matchIndex = unmatchedCheckoutItems.findIndex((checkoutItem) =>
      matchesQuoteItem(checkoutItem, quoteItem)
    );
    if (matchIndex === -1) {
      throwQuoteMismatch('INTERNATIONAL_QUOTE_ORDER_MISMATCH');
    }
    unmatchedCheckoutItems.splice(matchIndex, 1);
  }
}

export async function enrichShippingAddressWithQuoteDestination(
  supabase: SupabaseClient,
  selectedQuoteId: string | null | undefined,
  shippingAddress: OrderShippingAddressForQuote | undefined,
  context: QuoteCheckoutContext = {}
): Promise<OrderShippingAddressForQuote | undefined> {
  if (!selectedQuoteId || !shippingAddress) {
    return shippingAddress;
  }

  const { data: quote } = (await supabase
    .from('shipping_quotes')
    .select('provider_rate_id, quote_request, price')
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
  validateQuoteCheckoutContext(quote, quoteRequest, context);

  return {
    ...shippingAddress,
    country: quoteRequest.receiver.country,
    countryCode: quoteRequest.receiver.countryCode,
    postalCode: quoteRequest.receiver.postalCode,
  };
}

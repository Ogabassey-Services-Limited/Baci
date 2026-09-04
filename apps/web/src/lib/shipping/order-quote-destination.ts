import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderCreateInput } from '@/schemas/orders';
import { parseStoredQuoteRequest } from './order-shipment-booking-utils';
import type { ShippingProviderCode } from './types';

export type OrderShippingAddressForQuote = NonNullable<
  OrderCreateInput['shipping_address']
>;

type QuoteDestinationRecord = {
  expires_at?: string | null;
  merchant_id?: string | null;
  price?: number | string | null;
  provider?: string | null;
  provider_rate_id: string | null;
  quote_request: unknown;
};

type PhysicalQuoteMetadata = {
  height?: number;
  hsCode?: string;
  length?: number;
  weight?: number;
  width?: number;
};

type CheckoutItemForQuote = PhysicalQuoteMetadata & {
  name: string | null;
  negotiatedPrice?: number;
  price?: number | string | null;
  quantity: number | null;
  value?: number;
};

type QuoteCheckoutContext = {
  items?: CheckoutItemForQuote[];
  merchantId?: string;
  shippingFee?: number;
  shippingProvider?: ShippingProviderCode | string | null;
};

type CheckoutQuoteLookupResponse = {
  data: QuoteDestinationRecord[] | QuoteDestinationRecord | null;
  error?: { message?: string } | null;
};

export class OrderQuoteDestinationMismatchError extends Error {
  constructor(
    message = 'The saved shipping quote no longer matches this delivery address. Please get a new quote before checkout.',
    readonly code = 'INTERNATIONAL_QUOTE_DESTINATION_MISMATCH',
    readonly status = 400
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
  const normalizedQuoteValue = normalizeText(quoteValue);
  if (!normalizedOrderValue && !normalizedQuoteValue) return true;
  if (!normalizedOrderValue || !normalizedQuoteValue) return true;
  return normalizedOrderValue === normalizedQuoteValue;
}

export function normalizeAddressForQuoteMatch(
  address: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined
): string {
  const normalizedAddress = normalizeText(address);
  const normalizedCity = normalizeText(city);
  const normalizedState = normalizeText(state);
  if (!normalizedCity && !normalizedState) {
    return normalizedAddress;
  }
  const suffix = `, ${normalizedCity}, ${normalizedState}`;
  if (normalizedAddress.endsWith(suffix)) {
    return normalizedAddress.slice(0, -suffix.length).trim();
  }
  return normalizedAddress;
}

function matchesDomesticGiglQuoteAddress(
  shippingAddress: OrderShippingAddressForQuote,
  receiver: NonNullable<ReturnType<typeof parseStoredQuoteRequest>>['receiver']
): boolean {
  if (
    normalizeText(shippingAddress.city) !== normalizeText(receiver.city) ||
    normalizeText(shippingAddress.state) !== normalizeText(receiver.state)
  ) {
    return false;
  }

  const quoteStreet = normalizeText(receiver.address);
  const orderStreet = normalizeAddressForQuoteMatch(
    shippingAddress.address,
    shippingAddress.city,
    shippingAddress.state
  );
  if (orderStreet === quoteStreet) {
    return true;
  }

  const normalizedOrderAddress = normalizeText(shippingAddress.address);
  return normalizedOrderAddress.startsWith(`${quoteStreet},`);
}

function matchesQuoteDestination(
  shippingAddress: OrderShippingAddressForQuote,
  quoteRequest: NonNullable<ReturnType<typeof parseStoredQuoteRequest>>
): boolean {
  const receiver = quoteRequest.receiver;
  const addressMatches =
    quoteRequest.shipmentType === 'domestic'
      ? matchesDomesticGiglQuoteAddress(shippingAddress, receiver)
      : normalizeText(shippingAddress.address) ===
        normalizeText(receiver.address);

  return (
    addressMatches &&
    normalizeText(shippingAddress.city) === normalizeText(receiver.city) &&
    normalizeText(shippingAddress.state) === normalizeText(receiver.state) &&
    matchesOptionalText(shippingAddress.country, receiver.country) &&
    matchesOptionalText(shippingAddress.countryCode, receiver.countryCode) &&
    matchesOptionalText(shippingAddress.postalCode, receiver.postalCode)
  );
}

function throwQuoteMismatch(code: string, status = 400): never {
  throw new OrderQuoteDestinationMismatchError(
    'The saved shipping quote no longer matches this checkout. Please get a new quote before checkout.',
    code,
    status
  );
}

function readComparableItemValue(item: CheckoutItemForQuote): number {
  return Number(item.negotiatedPrice ?? item.value ?? item.price);
}

function hasComparableItemValue(item: CheckoutItemForQuote): boolean {
  return (
    item.negotiatedPrice !== undefined ||
    item.value !== undefined ||
    (item.price !== undefined && item.price !== null)
  );
}

function numbersMatch(
  left: number | undefined,
  right: number | undefined
): boolean {
  if (left === undefined) return true;
  if (right === undefined) return false;
  return Math.abs(left - right) <= 0.001;
}

function hasDimensions(
  item: Pick<PhysicalQuoteMetadata, 'height' | 'length' | 'width'>
): boolean {
  return (
    item.length !== undefined ||
    item.width !== undefined ||
    item.height !== undefined
  );
}

function matchesQuotePhysicalMetadata(
  checkoutItem: PhysicalQuoteMetadata,
  quoteItem: PhysicalQuoteMetadata
): boolean {
  if (!numbersMatch(checkoutItem.weight, quoteItem.weight)) {
    return false;
  }

  if (hasDimensions(checkoutItem) || hasDimensions(quoteItem)) {
    if (!hasDimensions(checkoutItem)) return true;
    if (
      !numbersMatch(checkoutItem.length, quoteItem.length) ||
      !numbersMatch(checkoutItem.width, quoteItem.width) ||
      !numbersMatch(checkoutItem.height, quoteItem.height)
    ) {
      return false;
    }
  }

  const checkoutHsCode = normalizeText(checkoutItem.hsCode);
  if (!checkoutHsCode) return true;
  return checkoutHsCode === normalizeText(quoteItem.hsCode);
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
    (!hasComparableItemValue(checkoutItem) ||
      readComparableItemValue(checkoutItem) === quoteItem.value) &&
    matchesQuotePhysicalMetadata(checkoutItem, quoteItem)
  );
}

function validateQuoteCheckoutContext(
  quote: QuoteDestinationRecord,
  quoteRequest: NonNullable<ReturnType<typeof parseStoredQuoteRequest>>,
  context: QuoteCheckoutContext
): void {
  if (!context.shippingProvider || !quote.provider) {
    throwQuoteMismatch('INTERNATIONAL_QUOTE_PROVIDER_MISMATCH');
  }

  if (quote.provider !== context.shippingProvider) {
    throwQuoteMismatch('INTERNATIONAL_QUOTE_PROVIDER_MISMATCH');
  }

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

async function lookupCheckoutQuote(
  supabase: SupabaseClient,
  selectedQuoteId: string,
  merchantId: string | undefined
): Promise<{
  error?: { message?: string } | null;
  quote: QuoteDestinationRecord | null;
}> {
  if (!merchantId) return { quote: null };

  const { data, error } = (await supabase.rpc('get_checkout_shipping_quote', {
    p_merchant_id: merchantId,
    p_quote_id: selectedQuoteId,
  })) as CheckoutQuoteLookupResponse;
  const quote = Array.isArray(data) ? data[0] : data;

  return { error, quote: quote ?? null };
}

export async function enrichShippingAddressWithQuoteDestination(
  supabase: SupabaseClient,
  selectedQuoteId: string | null | undefined,
  shippingAddress: OrderShippingAddressForQuote | undefined,
  context: QuoteCheckoutContext = {}
): Promise<OrderShippingAddressForQuote | undefined> {
  if (!selectedQuoteId) {
    return shippingAddress;
  }

  const { error: quoteError, quote } = await lookupCheckoutQuote(
    supabase,
    selectedQuoteId,
    context.merchantId
  );
  if (quoteError) {
    throw new OrderQuoteDestinationMismatchError(
      'Unable to validate the saved shipping quote. Please get a new quote before checkout.',
      'INTERNATIONAL_QUOTE_LOOKUP_FAILED',
      500
    );
  }

  if (
    !quote &&
    (context.shippingProvider || context.shippingFee !== undefined)
  ) {
    throwQuoteMismatch('INTERNATIONAL_QUOTE_ORDER_MISMATCH');
  }

  const isGiglQuote = quote?.provider === 'GIGL';
  if (!quote || !isGiglQuote) {
    return shippingAddress;
  }

  if (!shippingAddress) {
    throwQuoteMismatch('INTERNATIONAL_QUOTE_DESTINATION_MISMATCH');
  }

  const expiresAt = Date.parse(quote.expires_at ?? '');
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    throwQuoteMismatch('INTERNATIONAL_QUOTE_EXPIRED');
  }

  const quoteRequest = parseStoredQuoteRequest(quote.quote_request);
  if (!quoteRequest) {
    throwQuoteMismatch('INTERNATIONAL_QUOTE_REQUEST_MISSING');
  }

  if (!matchesQuoteDestination(shippingAddress, quoteRequest)) {
    throw new OrderQuoteDestinationMismatchError();
  }
  validateQuoteCheckoutContext(quote, quoteRequest, context);

  return {
    ...shippingAddress,
    country: quoteRequest.receiver.country ?? shippingAddress.country,
    countryCode:
      quoteRequest.receiver.countryCode ?? shippingAddress.countryCode,
    postalCode: quoteRequest.receiver.postalCode ?? shippingAddress.postalCode,
  };
}

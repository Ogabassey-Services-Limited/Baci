import type {
  QuoteRequest,
  ShipmentItem,
  ShippingAddress,
  ShippingProviderCode,
  ShippingQuote,
} from '@/lib/shipping/types';
import { SHIPPING_PROVIDER_CODES } from '@/lib/shipping/types';
import { matchesGiglProviderRate } from './matches-gigl-provider-rate';

type OrderShippingAddress = {
  address?: string | null;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  postalCode?: string | null;
  state?: string | null;
  phone?: string | null;
};

type OrderItemRecord = {
  name: string | null;
  quantity: number | null;
  price: number | string | null;
};

type OrderRecord = {
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: OrderShippingAddress | null;
};

export class OrderShipmentBookingError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly providerReference?: string,
    readonly details?: {
      availableBalance: number;
      chargedAmount: number;
      shortfall: number;
    }
  ) {
    super(message);
    this.name = 'OrderShipmentBookingError';
  }
}

export function isShippingProviderCode(
  value: string | null | undefined
): value is ShippingProviderCode {
  return (SHIPPING_PROVIDER_CODES as readonly string[]).includes(value ?? '');
}

function isShippingAddress(value: unknown): value is ShippingAddress {
  if (!value || typeof value !== 'object') return false;

  const address = value as Partial<ShippingAddress>;

  return (
    typeof address.name === 'string' &&
    typeof address.phone === 'string' &&
    typeof address.address === 'string' &&
    typeof address.city === 'string' &&
    typeof address.state === 'string'
  );
}

function isShipmentItem(value: unknown): value is ShipmentItem {
  if (!value || typeof value !== 'object') return false;

  const item = value as Partial<ShipmentItem>;

  return (
    typeof item.name === 'string' &&
    typeof item.quantity === 'number' &&
    typeof item.weight === 'number' &&
    typeof item.value === 'number'
  );
}

export function parseStoredQuoteRequest(value: unknown): QuoteRequest | null {
  if (!value || typeof value !== 'object') return null;

  const quoteRequest = value as Partial<QuoteRequest>;

  if (!isShippingAddress(quoteRequest.receiver)) return null;
  if (
    !Array.isArray(quoteRequest.items) ||
    !quoteRequest.items.every(isShipmentItem)
  ) {
    return null;
  }

  return {
    ...(quoteRequest.deliveryPreference === 'door' ||
    quoteRequest.deliveryPreference === 'pickup_station'
      ? { deliveryPreference: quoteRequest.deliveryPreference }
      : {}),
    merchantId:
      typeof quoteRequest.merchantId === 'string' &&
      quoteRequest.merchantId.trim().length > 0
        ? quoteRequest.merchantId
        : undefined,
    sessionId:
      typeof quoteRequest.sessionId === 'string' &&
      quoteRequest.sessionId.length > 0
        ? quoteRequest.sessionId
        : crypto.randomUUID(),
    shipmentType:
      quoteRequest.shipmentType === 'international'
        ? 'international'
        : 'domestic',
    ...(quoteRequest.admin_order_provenance === 'server_gigl_v1'
      ? { admin_order_provenance: 'server_gigl_v1' as const }
      : {}),
    sender: isShippingAddress(quoteRequest.sender)
      ? {
          ...quoteRequest.sender,
          country: quoteRequest.sender.country || 'Nigeria',
          countryCode: quoteRequest.sender.countryCode || 'NG',
        }
      : undefined,
    receiver: {
      ...quoteRequest.receiver,
      country: quoteRequest.receiver.country || 'Nigeria',
      countryCode: quoteRequest.receiver.countryCode || 'NG',
    },
    items: quoteRequest.items,
  };
}

export function toShipmentItems(orderItems: OrderItemRecord[]): ShipmentItem[] {
  return orderItems.map((item) => ({
    name: item.name || 'Order item',
    description: item.name || 'Order item',
    quantity: Math.max(1, item.quantity ?? 1),
    weight: 1,
    value: Number(item.price || 0),
  }));
}

export function selectPreferredQuote(
  quotes: ShippingQuote[],
  currentQuote: {
    serviceTier: string | null;
    carrierName: string | null;
    providerRateId?: string | null;
  }
): ShippingQuote | null {
  const normalizedServiceTier = currentQuote.serviceTier?.toLowerCase() ?? null;
  const normalizedCarrierName = currentQuote.carrierName?.toLowerCase() ?? null;
  const normalizedProviderRateId = currentQuote.providerRateId?.trim() || null;

  return (
    quotes.find(
      (quote) =>
        normalizedProviderRateId &&
        quote.providerRateId === normalizedProviderRateId
    ) ||
    quotes.find(
      (quote) =>
        normalizedProviderRateId &&
        matchesGiglProviderRate(normalizedProviderRateId, quote.providerRateId)
    ) ||
    quotes.find(
      (quote) =>
        quote.serviceTier.toLowerCase() === normalizedServiceTier &&
        quote.carrierName.toLowerCase() === normalizedCarrierName
    ) ||
    quotes.find(
      (quote) => quote.serviceTier.toLowerCase() === normalizedServiceTier
    ) ||
    quotes[0] ||
    null
  );
}

export function buildReceiver(order: OrderRecord): ShippingAddress {
  const shippingAddress = order.shipping_address ?? {};
  const address = shippingAddress.address?.trim();
  const city = shippingAddress.city?.trim();
  const state = shippingAddress.state?.trim();

  if (!address || !city || !state) {
    throw new OrderShipmentBookingError(
      'This order is missing a complete shipping address.',
      400,
      'INCOMPLETE_SHIPPING_ADDRESS'
    );
  }

  return {
    name: order.customer_name || 'Customer',
    email: order.customer_email || undefined,
    phone: order.customer_phone || shippingAddress.phone || '',
    address,
    city,
    state,
    country: shippingAddress.country?.trim() || 'Nigeria',
    countryCode: shippingAddress.countryCode?.trim() || 'NG',
    postalCode: shippingAddress.postalCode?.trim() || undefined,
  };
}

export { deriveMerchantLocation } from './merchant-location';
export { domesticSendersDiffer } from './merchant-sender-comparison';

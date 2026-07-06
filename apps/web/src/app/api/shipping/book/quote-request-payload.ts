import { parseStoredQuoteRequest } from '@/lib/shipping/order-shipment-booking-utils';
import { GIGL_INTERNATIONAL_PROVIDER_RATE_PREFIX } from '@/lib/shipping/providers/gigl.international-payload';
import type { ShipmentItem, ShippingAddress } from '@/lib/shipping/types';

type BookingQuoteRecord = {
  provider_code: string | null;
  provider_rate_id: string | null;
  quote_request?: unknown;
};

type QuoteRequestPayload = {
  items: ShipmentItem[];
  receiver: ShippingAddress;
};

export function resolveBookingQuoteRequestPayload(
  quote: BookingQuoteRecord,
  receiver: ShippingAddress,
  items: ShipmentItem[]
): QuoteRequestPayload | null {
  const isGiglInternationalQuote =
    quote.provider_code === 'GIGL' &&
    quote.provider_rate_id?.startsWith(
      `${GIGL_INTERNATIONAL_PROVIDER_RATE_PREFIX}_`
    ) === true;

  if (!isGiglInternationalQuote) {
    return { items, receiver };
  }

  const storedQuoteRequest = parseStoredQuoteRequest(quote.quote_request);
  if (!storedQuoteRequest) {
    return null;
  }

  return {
    items: storedQuoteRequest.items,
    receiver: {
      ...storedQuoteRequest.receiver,
      name: receiver.name,
      email: receiver.email,
      phone: receiver.phone,
    },
  };
}

import {
  assertInternationalQuoteMatchesOrder,
  type InternationalQuoteOrder,
} from '@/lib/shipping/international-quote-order-guard';
import {
  type InternationalShipmentOrderItem,
  toInternationalShipmentItemsFromOrder,
} from '@/lib/shipping/international-shipment-items';
import {
  OrderShipmentBookingError,
  parseStoredQuoteRequest,
} from '@/lib/shipping/order-shipment-booking-utils';
import { GIGL_INTERNATIONAL_PROVIDER_RATE_PREFIX } from '@/lib/shipping/providers/gigl.international-payload';
import type {
  QuoteRequest,
  ShipmentItem,
  ShippingAddress,
} from '@/lib/shipping/types';

type BookingQuoteRecord = {
  provider_code: string | null;
  provider_rate_id: string | null;
  quote_request?: unknown;
};

type QuoteRequestPayload = {
  items: ShipmentItem[];
  receiver: ShippingAddress;
  storedQuoteRequest?: QuoteRequest;
};

export type BookingQuoteValidation =
  | { ok: true }
  | { code: string; error: string; ok: false; status: number };

export function resolveBookingQuoteRequestPayload(
  quote: BookingQuoteRecord,
  receiver: ShippingAddress,
  items: ShipmentItem[],
  orderItems: InternationalShipmentOrderItem[] = []
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
    items: toInternationalShipmentItemsFromOrder(orderItems),
    receiver: {
      ...storedQuoteRequest.receiver,
      name: receiver.name,
      email: receiver.email,
      phone: receiver.phone,
    },
    storedQuoteRequest,
  };
}

export function validateBookingQuoteRequestPayload(
  payload: QuoteRequestPayload,
  order: InternationalQuoteOrder
): BookingQuoteValidation {
  if (!payload.storedQuoteRequest) {
    return { ok: true };
  }

  try {
    assertInternationalQuoteMatchesOrder(payload.storedQuoteRequest, order);
    return { ok: true };
  } catch (error) {
    if (error instanceof OrderShipmentBookingError) {
      return {
        ok: false,
        error: error.message,
        code: error.code,
        status: error.status,
      };
    }
    throw error;
  }
}

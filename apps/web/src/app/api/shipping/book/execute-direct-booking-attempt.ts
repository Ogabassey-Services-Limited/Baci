import type { SupabaseClient } from '@supabase/supabase-js';
import { shippingService } from '@/lib/shipping';
import {
  isShippingProviderCode,
  OrderShipmentBookingError,
} from '@/lib/shipping/order-shipment-booking-utils';
import type { OrderShipmentQuoteRecord } from '@/lib/shipping/refresh-order-shipment-quote';
import { resolveBookingMerchantSender } from '@/lib/shipping/resolve-booking-merchant-sender';
import type {
  BookingRequest,
  ShipmentBookingResult,
  ShipmentItem,
  ShippingAddress,
} from '@/lib/shipping/types';
import { resolveBookingQuoteForSender } from './resolve-booking-quote-for-sender';

type DirectBookingPayload = {
  receiver: ShippingAddress;
  items: ShipmentItem[];
  sender?: ShippingAddress;
};

export async function executeDirectBookingAttempt(params: {
  supabase: SupabaseClient;
  merchantId: string;
  merchantBusinessName?: string | null;
  orderId: string;
  quote: OrderShipmentQuoteRecord;
  quotePayload: DirectBookingPayload;
  usesStoredInternationalSender: boolean;
  expectedShippingFee?: number | string | null;
  instructions?: string;
}): Promise<{
  bookingQuote: OrderShipmentQuoteRecord;
  result: ShipmentBookingResult;
  senderInfo: ShippingAddress;
}> {
  const {
    supabase,
    merchantId,
    merchantBusinessName,
    orderId,
    quote,
    quotePayload,
    usesStoredInternationalSender,
    expectedShippingFee,
    instructions,
  } = params;

  if (!isShippingProviderCode(quote.provider)) {
    throw new OrderShipmentBookingError(
      'Invalid shipping provider in quote',
      400,
      'INVALID_SHIPPING_PROVIDER'
    );
  }

  let merchantSender: ShippingAddress | undefined;
  if (!usesStoredInternationalSender) {
    const merchantSenderResult = await resolveBookingMerchantSender(
      supabase,
      merchantId,
      merchantBusinessName
    );
    if (!merchantSenderResult.ok) {
      throw new OrderShipmentBookingError(
        merchantSenderResult.error,
        merchantSenderResult.status,
        'MERCHANT_SENDER_REQUIRED'
      );
    }
    merchantSender = merchantSenderResult.sender;
  }

  const bookingQuote = await resolveBookingQuoteForSender(
    supabase,
    quote,
    quote.provider,
    {
      merchantSender,
      usesStoredInternationalSender,
      expectedShippingFee,
    }
  );

  const senderInfo = quotePayload.sender ?? merchantSender;
  if (!senderInfo) {
    throw new OrderShipmentBookingError(
      'Registered merchant sender is required for domestic shipment booking.',
      400,
      'MERCHANT_SENDER_REQUIRED'
    );
  }

  const bookingRequest: BookingRequest = {
    orderId,
    quoteId: bookingQuote.id,
    providerRateId: bookingQuote.provider_rate_id || undefined,
    quoteMetadata: bookingQuote.provider_metadata,
    sender: senderInfo,
    receiver: quotePayload.receiver,
    items: quotePayload.items,
    instructions,
  };

  const result = await shippingService.bookShipment(
    quote.provider,
    bookingRequest
  );

  return { bookingQuote, result, senderInfo };
}

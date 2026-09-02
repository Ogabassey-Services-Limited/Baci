import type { SupabaseClient } from '@supabase/supabase-js';
import { shippingService } from '@/lib/shipping';
import { assertQuotePriceMatchesOrderFee } from '@/lib/shipping/assert-quote-price-matches-order-fee';
import { attachBookingQuoteMetadata } from '@/lib/shipping/attach-booking-quote-metadata';
import { buildOrderShipmentBookingRequest } from '@/lib/shipping/build-order-shipment-booking-request';
import {
  findReusableOrderShipment,
  type ReusableOrderShipmentResult,
} from '@/lib/shipping/find-reusable-order-shipment';
import { assertInternationalQuoteMatchesOrder } from '@/lib/shipping/international-quote-order-guard';
import {
  type InternationalShipmentOrderItem,
  toInternationalShipmentItemsFromOrder,
} from '@/lib/shipping/international-shipment-items';
import {
  buildReceiver,
  isShippingProviderCode,
  OrderShipmentBookingError,
  parseStoredQuoteRequest,
  toShipmentItems,
} from '@/lib/shipping/order-shipment-booking-utils';
import { isGiglInternationalProviderRate } from '@/lib/shipping/providers/gigl.international-payload';
import {
  type OrderShipmentQuoteRecord,
  refreshOrderShipmentQuote,
} from '@/lib/shipping/refresh-order-shipment-quote';
import { resolveBookingMerchantSender } from '@/lib/shipping/resolve-booking-merchant-sender';
import type { ShippingAddress } from '@/lib/shipping/types';

type OrderRecord = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_fee: number | string | null;
  selected_quote_id: string | null;
  shipping_provider: string | null;
  shipping_funding_source?: 'customer_checkout' | 'merchant_wallet' | null;
  shipping_address: {
    address?: string | null;
    city?: string | null;
    country?: string | null;
    countryCode?: string | null;
    postalCode?: string | null;
    state?: string | null;
    phone?: string | null;
  } | null;
  order_items: InternationalShipmentOrderItem[] | null;
};

export type BookOrderShipmentResult = ReusableOrderShipmentResult;

export async function bookOrderShipment(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string,
  quoteIdOverride?: string
): Promise<BookOrderShipmentResult> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, customer_name, customer_email, customer_phone, shipping_fee, selected_quote_id, shipping_provider, shipping_funding_source, shipping_address, order_items(name, quantity, price, product_id, product:products!order_items_product_id_fkey(weight_value, weight_unit, dimensions, commodity_code))'
    )
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .single();
  const typedOrder = order as OrderRecord | null;

  if (orderError || !typedOrder) {
    throw new OrderShipmentBookingError(
      'Order not found',
      404,
      'ORDER_NOT_FOUND'
    );
  }
  const existingShipment = await findReusableOrderShipment(
    supabase,
    merchantId,
    orderId
  );
  if (existingShipment) {
    return {
      ...existingShipment,
      quoteId: existingShipment.quoteId || typedOrder.selected_quote_id || '',
    };
  }
  const selectedQuoteId = quoteIdOverride ?? typedOrder.selected_quote_id;
  if (!selectedQuoteId) {
    throw new OrderShipmentBookingError(
      'This order does not have a saved shipping quote. Please get a new quote before shipping.',
      400,
      'MISSING_SHIPPING_QUOTE'
    );
  }
  if (!isShippingProviderCode(typedOrder.shipping_provider)) {
    throw new OrderShipmentBookingError(
      'This order is not configured for provider-backed shipping.',
      400,
      'INVALID_SHIPPING_PROVIDER'
    );
  }
  const orderItems = typedOrder.order_items ?? [];
  if (orderItems.length === 0) {
    throw new OrderShipmentBookingError(
      'Cannot book a shipment for an order with no items.',
      400,
      'MISSING_ORDER_ITEMS'
    );
  }
  const { data: storedQuote, error: quoteError } = await supabase
    .from('shipping_quotes')
    .select(
      'id, merchant_id, provider, service_tier, carrier_name, price, currency, estimated_days, provider_rate_id, expires_at, quote_request'
    )
    .eq('id', selectedQuoteId)
    .eq('merchant_id', merchantId)
    .single();
  const typedStoredQuote = storedQuote as OrderShipmentQuoteRecord | null;

  if (quoteError || !typedStoredQuote) {
    throw new OrderShipmentBookingError(
      'The saved shipping quote could not be found.',
      404,
      'QUOTE_NOT_FOUND'
    );
  }
  const bookingQuote = await attachBookingQuoteMetadata(
    supabase,
    merchantId,
    typedOrder.id,
    typedStoredQuote
  );

  const isGiglInternationalQuote = isGiglInternationalProviderRate(
    typedOrder.shipping_provider,
    typedStoredQuote.provider_rate_id
  );
  const storedQuoteRequest = parseStoredQuoteRequest(
    typedStoredQuote.quote_request
  );
  const isInternationalQuote =
    isGiglInternationalQuote ||
    storedQuoteRequest?.shipmentType === 'international';
  if (isGiglInternationalQuote && !storedQuoteRequest) {
    throw new OrderShipmentBookingError(
      'The saved international shipping quote is missing its original request. Please get a new quote before shipping.',
      400,
      'INTERNATIONAL_QUOTE_REQUEST_MISSING'
    );
  }
  let merchantSender: ShippingAddress | undefined;
  if (!isInternationalQuote) {
    const merchantSenderResult = await resolveBookingMerchantSender(
      supabase,
      merchantId
    );
    if (!merchantSenderResult.ok) {
      const isOriginMissing = merchantSenderResult.status === 400;
      const isMerchantMissing = merchantSenderResult.status === 404;
      throw new OrderShipmentBookingError(
        isOriginMissing
          ? 'Merchant shipping origin is not configured.'
          : isMerchantMissing
            ? 'Merchant details not found.'
            : 'Failed to resolve merchant shipping origin. Please try again.',
        merchantSenderResult.status,
        isOriginMissing
          ? 'MERCHANT_ORIGIN_MISSING'
          : isMerchantMissing
            ? 'MERCHANT_NOT_FOUND'
            : 'MERCHANT_LOOKUP_FAILED'
      );
    }
    merchantSender = merchantSenderResult.sender;
  }
  const resolvedQuote = await refreshOrderShipmentQuote(
    supabase,
    bookingQuote,
    typedOrder.shipping_provider,
    merchantSender,
    typedOrder.shipping_funding_source === 'merchant_wallet'
      ? { allowRefresh: false }
      : undefined
  );
  if (typedOrder.shipping_funding_source !== 'merchant_wallet') {
    assertQuotePriceMatchesOrderFee(resolvedQuote, typedOrder.shipping_fee);
  }
  const resolvedQuoteRequest = parseStoredQuoteRequest(
    resolvedQuote.quote_request
  );
  const effectiveQuoteRequest = resolvedQuoteRequest ?? storedQuoteRequest;
  const orderReceiver = buildReceiver(typedOrder);
  if (isInternationalQuote && effectiveQuoteRequest) {
    assertInternationalQuoteMatchesOrder(effectiveQuoteRequest, typedOrder);
  }

  const receiver =
    isInternationalQuote && effectiveQuoteRequest
      ? {
          ...effectiveQuoteRequest.receiver,
          name: orderReceiver.name,
          email: orderReceiver.email,
          phone: orderReceiver.phone,
        }
      : orderReceiver;
  const sender =
    isInternationalQuote && effectiveQuoteRequest?.sender
      ? effectiveQuoteRequest.sender
      : merchantSender;
  if (!sender) {
    throw new OrderShipmentBookingError(
      'The saved international shipping quote is missing its sender. Please get a new quote before shipping.',
      400,
      'INTERNATIONAL_QUOTE_SENDER_MISSING'
    );
  }
  const items =
    isInternationalQuote && effectiveQuoteRequest
      ? toInternationalShipmentItemsFromOrder(
          orderItems,
          effectiveQuoteRequest.items
        )
      : toShipmentItems(orderItems);

  const bookingRequest = buildOrderShipmentBookingRequest({
    items,
    orderId: typedOrder.id,
    quote: resolvedQuote,
    receiver,
    sender,
  });

  const result = await shippingService.bookShipment(
    typedOrder.shipping_provider,
    bookingRequest
  );
  const { data: shipment, error: shipmentError } = await supabase
    .from('shipments')
    .insert({
      order_id: typedOrder.id,
      merchant_id: merchantId,
      provider: result.provider,
      provider_shipment_id: result.providerShipmentId,
      shipping_quote_id: resolvedQuote.id,
      tracking_number: result.trackingNumber,
      carrier_name: result.carrierName,
      status: result.status,
      sender_address: sender,
      receiver_address: receiver,
      items,
      price: Number(resolvedQuote.price),
      currency: resolvedQuote.currency,
      estimated_delivery_days: resolvedQuote.estimated_days,
      is_station_pickup: result.isStationPickup ?? false,
      station_name: result.pickupStationName ?? null,
      station_address: result.pickupStationAddress ?? null,
      pickup_scheduled_at: result.pickupScheduledAt?.toISOString(),
      label_url: result.labelUrl,
      provider_response: result.rawResponse,
    })
    .select('id')
    .single();
  const typedShipment = shipment as { id: string } | null;

  if (shipmentError || !typedShipment) {
    throw new OrderShipmentBookingError(
      `Shipment booked with ${result.provider} but could not be saved locally. Tracking: ${result.trackingNumber}`,
      500,
      'SHIPMENT_SAVE_FAILED'
    );
  }

  const { error: quoteUpdateError } = await supabase
    .from('shipping_quotes')
    .update({ used: true })
    .eq('id', resolvedQuote.id)
    .eq('merchant_id', merchantId);

  if (quoteUpdateError) {
    console.error('Shipment booked but quote could not be marked as used', {
      error: quoteUpdateError,
      orderId,
      provider: result.provider,
      quoteId: resolvedQuote.id,
      trackingNumber: result.trackingNumber,
    });
  }
  return {
    shipmentId: typedShipment.id,
    provider: result.provider,
    providerShipmentId: result.providerShipmentId,
    trackingNumber: result.trackingNumber,
    carrierName: result.carrierName,
    quoteId: resolvedQuote.id,
    estimatedDays: resolvedQuote.estimated_days,
    labelUrl: result.labelUrl,
    pickupScheduledAt: result.pickupScheduledAt,
    shipmentStatus: result.status,
  };
}

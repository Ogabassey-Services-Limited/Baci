import type { SupabaseClient } from '@supabase/supabase-js';
import { shippingService } from '@/lib/shipping';
import { assertInternationalQuoteMatchesOrder } from '@/lib/shipping/international-quote-order-guard';
import {
  type InternationalShipmentOrderItem,
  toInternationalShipmentItemsFromOrder,
} from '@/lib/shipping/international-shipment-items';
import { buildMerchantSenderInfo } from '@/lib/shipping/merchant-sender-location';
import {
  buildReceiver,
  isShippingProviderCode,
  OrderShipmentBookingError,
  parseStoredQuoteRequest,
  selectPreferredQuote,
  toShipmentItems,
} from '@/lib/shipping/order-shipment-booking-utils';
import { isGiglInternationalProviderRate } from '@/lib/shipping/providers/gigl.international-payload';
import type {
  BookingRequest,
  ShipmentBookingResult,
  ShippingProviderCode,
} from '@/lib/shipping/types';

type QuoteRecord = {
  id: string;
  merchant_id: string | null;
  provider: string;
  service_tier: string | null;
  carrier_name: string | null;
  price: number | string;
  currency: string;
  estimated_days: number | null;
  provider_rate_id: string | null;
  expires_at: string;
  quote_request: unknown;
  provider_metadata: unknown;
};

type OrderRecord = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  selected_quote_id: string | null;
  shipping_provider: string | null;
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

type MerchantRecord = {
  business_name: string | null;
  business_address: string | null;
  phone: string | null;
  registered_address: unknown;
  state_code: string | null;
};

type ExistingShipmentRecord = {
  id: string;
  provider: ShippingProviderCode;
  provider_shipment_id: string | null;
  tracking_number: string | null;
  carrier_name: string | null;
  estimated_delivery_days: number | null;
  label_url: string | null;
  pickup_scheduled_at: string | null;
  status: ShipmentBookingResult['status'];
};

const REUSABLE_SHIPMENT_STATUSES: ShipmentBookingResult['status'][] = [
  'pending',
  'booked',
  'pickup_scheduled',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
];

export interface BookOrderShipmentResult {
  shipmentId: string;
  provider: ShippingProviderCode;
  providerShipmentId: string;
  trackingNumber: string;
  carrierName: string;
  quoteId: string;
  estimatedDays: number | null;
  labelUrl?: string;
  pickupScheduledAt?: Date;
  shipmentStatus: ShipmentBookingResult['status'];
}

async function resolveQuote(
  supabase: SupabaseClient,
  quote: QuoteRecord,
  provider: ShippingProviderCode
): Promise<QuoteRecord> {
  const needsRefresh =
    new Date(quote.expires_at) < new Date() ||
    (provider === 'TOPSHIP' && !quote.provider_metadata);

  if (!needsRefresh) {
    return quote;
  }

  const quoteRequest = parseStoredQuoteRequest(quote.quote_request);
  if (!quoteRequest) {
    throw new OrderShipmentBookingError(
      'The saved shipping quote has expired and cannot be refreshed.',
      400,
      'QUOTE_REFRESH_UNAVAILABLE'
    );
  }

  const freshQuotes = await shippingService.getProviderQuotes(provider, {
    ...quoteRequest,
    sessionId: crypto.randomUUID(),
  });
  const replacement = selectPreferredQuote(freshQuotes, {
    serviceTier: quote.service_tier,
    carrierName: quote.carrier_name,
    providerRateId: quote.provider_rate_id,
  });

  if (!replacement) {
    throw new OrderShipmentBookingError(
      'No active shipping quote is available for this provider right now.',
      400,
      'QUOTE_REFRESH_FAILED'
    );
  }

  const nextQuote: QuoteRecord = {
    id: replacement.id,
    merchant_id: quote.merchant_id,
    provider,
    service_tier: replacement.serviceTier,
    carrier_name: replacement.carrierName,
    price: replacement.price,
    currency: replacement.currency,
    estimated_days: replacement.estimatedDays,
    provider_rate_id: replacement.providerRateId || null,
    expires_at: replacement.expiresAt.toISOString(),
    quote_request: quoteRequest,
    provider_metadata: replacement.rawResponse,
  };

  await supabase.from('shipping_quotes').upsert(
    {
      id: nextQuote.id,
      merchant_id: quote.merchant_id,
      session_id: quoteRequest.sessionId,
      provider,
      service_tier: nextQuote.service_tier,
      carrier_name: nextQuote.carrier_name,
      price: nextQuote.price,
      currency: nextQuote.currency,
      estimated_days: nextQuote.estimated_days,
      provider_rate_id: nextQuote.provider_rate_id,
      expires_at: nextQuote.expires_at,
      quote_request: quoteRequest,
      provider_metadata: nextQuote.provider_metadata,
    },
    { onConflict: 'id' }
  );

  return nextQuote;
}

async function findReusableShipment(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string
): Promise<BookOrderShipmentResult | null> {
  const { data: existingShipment, error: existingShipmentError } =
    await supabase
      .from('shipments')
      .select(
        'id, provider, provider_shipment_id, tracking_number, carrier_name, estimated_delivery_days, label_url, pickup_scheduled_at, status'
      )
      .eq('order_id', orderId)
      .eq('merchant_id', merchantId)
      .in('status', REUSABLE_SHIPMENT_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
  const typedExistingShipment =
    existingShipment as ExistingShipmentRecord | null;

  if (existingShipmentError) {
    throw new OrderShipmentBookingError(
      'Failed to load the existing shipment for this order.',
      500,
      'EXISTING_SHIPMENT_LOOKUP_FAILED'
    );
  }

  if (!typedExistingShipment) {
    return null;
  }

  if (
    !typedExistingShipment.provider_shipment_id ||
    !typedExistingShipment.tracking_number ||
    !typedExistingShipment.carrier_name
  ) {
    throw new OrderShipmentBookingError(
      'A shipment is already saved for this order but is missing booking details. Please review it before retrying.',
      500,
      'INCOMPLETE_EXISTING_SHIPMENT'
    );
  }

  return {
    shipmentId: typedExistingShipment.id,
    provider: typedExistingShipment.provider,
    providerShipmentId: typedExistingShipment.provider_shipment_id,
    trackingNumber: typedExistingShipment.tracking_number,
    carrierName: typedExistingShipment.carrier_name,
    quoteId: '',
    estimatedDays: typedExistingShipment.estimated_delivery_days,
    labelUrl: typedExistingShipment.label_url || undefined,
    pickupScheduledAt: typedExistingShipment.pickup_scheduled_at
      ? new Date(typedExistingShipment.pickup_scheduled_at)
      : undefined,
    shipmentStatus: typedExistingShipment.status,
  };
}

export async function bookOrderShipment(
  supabase: SupabaseClient,
  merchantId: string,
  orderId: string
): Promise<BookOrderShipmentResult> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, customer_name, customer_email, customer_phone, selected_quote_id, shipping_provider, shipping_address, order_items(name, quantity, price, product_id, product:products!order_items_product_id_fkey(weight_value, weight_unit, dimensions, commodity_code))'
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

  const existingShipment = await findReusableShipment(
    supabase,
    merchantId,
    orderId
  );
  if (existingShipment) {
    return {
      ...existingShipment,
      quoteId: typedOrder.selected_quote_id || existingShipment.quoteId,
    };
  }

  if (!typedOrder.selected_quote_id) {
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
      'id, merchant_id, provider, service_tier, carrier_name, price, currency, estimated_days, provider_rate_id, expires_at, quote_request, provider_metadata'
    )
    .eq('id', typedOrder.selected_quote_id)
    .eq('merchant_id', merchantId)
    .single();
  const typedStoredQuote = storedQuote as QuoteRecord | null;

  if (quoteError || !typedStoredQuote) {
    throw new OrderShipmentBookingError(
      'The saved shipping quote could not be found.',
      404,
      'QUOTE_NOT_FOUND'
    );
  }

  const resolvedQuote = await resolveQuote(
    supabase,
    typedStoredQuote,
    typedOrder.shipping_provider
  );
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select(
      'business_name, business_address, phone, registered_address, state_code'
    )
    .eq('id', merchantId)
    .single();
  const typedMerchant = merchant as MerchantRecord | null;

  if (merchantError || !typedMerchant) {
    throw new OrderShipmentBookingError(
      'Merchant details not found.',
      404,
      'MERCHANT_NOT_FOUND'
    );
  }

  const storedQuoteRequest = parseStoredQuoteRequest(
    resolvedQuote.quote_request
  );
  const isGiglInternationalQuote = isGiglInternationalProviderRate(
    typedOrder.shipping_provider,
    resolvedQuote.provider_rate_id
  );

  if (isGiglInternationalQuote && !storedQuoteRequest) {
    throw new OrderShipmentBookingError(
      'The saved international shipping quote is missing its original request. Please get a new quote before shipping.',
      400,
      'INTERNATIONAL_QUOTE_REQUEST_MISSING'
    );
  }

  const orderReceiver = buildReceiver(typedOrder);
  if (isGiglInternationalQuote && storedQuoteRequest) {
    assertInternationalQuoteMatchesOrder(storedQuoteRequest, typedOrder);
  }

  const receiver =
    isGiglInternationalQuote && storedQuoteRequest
      ? {
          ...storedQuoteRequest.receiver,
          name: orderReceiver.name,
          email: orderReceiver.email,
          phone: orderReceiver.phone,
        }
      : orderReceiver;
  const merchantSender = buildMerchantSenderInfo({
    businessAddress: typedMerchant.business_address,
    businessName: typedMerchant.business_name,
    phone: typedMerchant.phone,
    registeredAddress: typedMerchant.registered_address,
    stateCode: typedMerchant.state_code,
  });
  const sender =
    isGiglInternationalQuote && storedQuoteRequest?.sender
      ? storedQuoteRequest.sender
      : merchantSender;
  const items =
    isGiglInternationalQuote && storedQuoteRequest
      ? toInternationalShipmentItemsFromOrder(
          orderItems,
          storedQuoteRequest.items
        )
      : toShipmentItems(orderItems);

  const bookingRequest: BookingRequest = {
    orderId: typedOrder.id,
    quoteId: resolvedQuote.id,
    providerRateId: resolvedQuote.provider_rate_id || undefined,
    quoteMetadata: resolvedQuote.provider_metadata,
    sender,
    receiver,
    items,
  };

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

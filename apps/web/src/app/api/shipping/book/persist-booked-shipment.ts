import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderShipmentQuoteRecord } from '@/lib/shipping/refresh-order-shipment-quote';
import type {
  ShipmentBookingResult,
  ShipmentItem,
  ShippingAddress,
} from '@/lib/shipping/types';
import { buildShipmentInsertPayload } from './shipment-insert-payload';

export async function persistBookedShipment(params: {
  supabase: SupabaseClient;
  orderId: string;
  merchantId: string;
  senderInfo: ShippingAddress;
  receiver: ShippingAddress;
  items: ShipmentItem[];
  bookingQuote: OrderShipmentQuoteRecord;
  result: ShipmentBookingResult;
}): Promise<
  | { ok: true; shipmentId: string }
  | { ok: false; error: string; trackingNumber: string; status: 500 }
> {
  const {
    supabase,
    orderId,
    merchantId,
    senderInfo,
    receiver,
    items,
    bookingQuote,
    result,
  } = params;

  const { data: shipment, error: shipmentError } = await supabase
    .from('shipments')
    .insert(
      buildShipmentInsertPayload({
        orderId,
        merchantId,
        senderInfo,
        receiver,
        items,
        quote: {
          price: Number(bookingQuote.price),
          currency: bookingQuote.currency,
          estimated_days: bookingQuote.estimated_days,
        },
        result,
      })
    )
    .select('id')
    .single();

  if (shipmentError || !shipment?.id) {
    console.error('Error creating shipment record:', shipmentError);
    return {
      ok: false,
      status: 500,
      trackingNumber: result.trackingNumber,
      error:
        'Shipment booked with provider but failed to save record. Contact support with tracking number: ' +
        result.trackingNumber,
    };
  }

  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({
      shipment_id: shipment.id,
      shipping_status: 'processing',
      shipping_provider: result.provider,
      tracking_number: result.trackingNumber,
      selected_quote_id: bookingQuote.id,
      fulfillment_type: 'provider',
    })
    .eq('id', orderId)
    .eq('merchant_id', merchantId);

  if (orderUpdateError) {
    console.error('Error updating order with shipment info:', orderUpdateError);
    return {
      ok: false,
      status: 500,
      trackingNumber: result.trackingNumber,
      error:
        'Shipment booked with provider but failed to update order. Contact support with tracking number: ' +
        result.trackingNumber,
    };
  }

  const { error: quoteUpdateError } = await supabase
    .from('shipping_quotes')
    .update({ used: true })
    .eq('id', bookingQuote.id)
    .eq('merchant_id', merchantId);

  if (quoteUpdateError) {
    console.error(
      'Error marking quote as used after successful shipment booking:',
      {
        error: quoteUpdateError,
        quoteId: bookingQuote.id,
        trackingNumber: result.trackingNumber,
      }
    );
  }

  return { ok: true, shipmentId: shipment.id };
}

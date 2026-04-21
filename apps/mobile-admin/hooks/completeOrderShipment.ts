import type { QueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import type { ShipmentCompletionMode } from '@/lib/order-shipment';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';

interface FulfillmentDetails {
  imei: string;
  serialNumber: string;
}

interface ShipmentCompletionResult {
  actionLabel: string;
  actionVariant: 'default' | 'whatsapp';
  message: string;
  showAction: boolean;
  subMessage: string;
  title: string;
}

interface CompleteOrderShipmentParams {
  fulfillmentDetails: FulfillmentDetails;
  handleSaveRider: (phone: string) => Promise<void>;
  mode: ShipmentCompletionMode;
  order: OrderDetailsRecord;
  providerBookingAvailable: boolean;
  providerLabel: string;
  queryClient: QueryClient;
  riderPhone: string;
  saveDetails: boolean;
  updateStatus: (input: { orderId: string; status: 'shipped' }) => Promise<unknown>;
}

export async function completeOrderShipment({
  fulfillmentDetails,
  handleSaveRider,
  mode,
  order,
  providerBookingAvailable,
  providerLabel,
  queryClient,
  riderPhone,
  saveDetails,
  updateStatus,
}: CompleteOrderShipmentParams): Promise<ShipmentCompletionResult> {
  if (saveDetails) {
    const { error } = await supabase
      .from('orders')
      .update({
        fulfillment_details: fulfillmentDetails,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (error) {
      throw error;
    }
  }

  if (mode === 'self_fulfillment') {
    const dispatchPhone = riderPhone.trim();
    if (!dispatchPhone) {
      throw new Error('Please enter a rider phone number');
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Unauthorized');
    }

    const response = await fetch(`${BASE_URL}/api/shipping/self-fulfill`, {
      body: JSON.stringify({
        carrierName: 'Dispatch Rider',
        dispatchNotes: `Self-fulfilled from mobile admin for order ${order.order_number}`,
        dispatchPhone,
        orderId: order.id,
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      method: 'POST',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        typeof payload.error === 'string'
          ? payload.error
          : 'Failed to mark order as self-fulfilled';
      throw new Error(message);
    }

    await handleSaveRider(dispatchPhone);
  } else {
    if (!providerBookingAvailable) {
      throw new Error(
        'This order does not have a saved provider quote to book against.'
      );
    }

    await updateStatus({ orderId: order.id, status: 'shipped' });
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      fetch(`${BASE_URL}/api/orders/${order.id}/shipped`, {
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        method: 'POST',
      }).catch(() => {});
    }
  } catch {}

  queryClient.invalidateQueries({ queryKey: ['order', order.id] });
  queryClient.invalidateQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['order-counts'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

  return {
    actionLabel:
      mode === 'self_fulfillment' ? 'Send Order Details to Rider' : '',
    actionVariant: mode === 'self_fulfillment' ? 'whatsapp' : 'default',
    message:
      mode === 'self_fulfillment'
        ? 'The order has been marked shipped. Customer notification has been triggered.'
        : providerLabel
          ? `The order has been booked with ${providerLabel} and marked shipped.`
          : 'The order has been marked shipped.',
    showAction: mode === 'self_fulfillment',
    subMessage:
      mode === 'self_fulfillment'
        ? 'You can now send the delivery details to your dispatch rider on WhatsApp.'
        : 'The customer has been notified of the shipment update.',
    title: mode === 'self_fulfillment' ? 'Order Shipped' : 'Shipment Booked',
  };
}

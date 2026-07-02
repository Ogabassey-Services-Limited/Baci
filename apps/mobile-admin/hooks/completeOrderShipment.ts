import type { QueryClient } from '@tanstack/react-query';
import type { OrderDetailsRecord } from '@/components/orders/order-details.types';
import { BASE_URL } from '@/lib/api-client';
import {
  buildOrderFulfillmentDetailsForPersistence,
  type ShipmentCompletionMode,
  type ShipmentFulfillmentDetails,
} from '@/lib/order-shipment';
import { supabase } from '@/lib/supabase';

interface ShipmentCompletionResult {
  actionLabel: string;
  actionVariant: 'default' | 'whatsapp';
  message: string;
  showAction: boolean;
  subMessage: string;
  title: string;
}

interface CompleteOrderShipmentParams {
  fulfillmentDetails: ShipmentFulfillmentDetails;
  handleSaveRider: (phone: string) => Promise<void>;
  merchantId: string;
  mode: ShipmentCompletionMode;
  order: OrderDetailsRecord;
  providerBookingAvailable: boolean;
  providerLabel: string;
  queryClient: QueryClient;
  riderPhone: string;
  saveDetails: boolean;
  updateStatus: (input: {
    orderId: string;
    status: 'shipped';
  }) => Promise<unknown>;
}

export async function completeOrderShipment({
  fulfillmentDetails,
  handleSaveRider,
  merchantId,
  mode,
  order,
  providerBookingAvailable,
  providerLabel,
  queryClient,
  riderPhone,
  saveDetails,
  updateStatus,
}: CompleteOrderShipmentParams): Promise<ShipmentCompletionResult> {
  // Rider phone is optional for self-fulfillment — the merchant can add it
  // later via the post-shipment "Send to Rider" WhatsApp action.
  const dispatchPhone = riderPhone.trim();

  if (mode !== 'self_fulfillment' && !providerBookingAvailable) {
    throw new Error(
      'This order does not have a saved provider quote to book against.'
    );
  }

  if (saveDetails) {
    const { error } = await supabase
      .from('orders')
      .update({
        fulfillment_details:
          buildOrderFulfillmentDetailsForPersistence(fulfillmentDetails),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .eq('merchant_id', merchantId);

    if (error) {
      throw error;
    }
  }

  if (mode === 'self_fulfillment') {
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
      }).catch(() => {
        // Ignore best-effort shipment notification failures.
      });
    }
  } catch {
    // Ignore best-effort shipment notification failures.
  }

  queryClient.invalidateQueries({ queryKey: ['order', order.id] });
  queryClient.invalidateQueries({ queryKey: ['orders'] });
  queryClient.invalidateQueries({ queryKey: ['order-counts'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

  // Only offer the "Send Order Details to Rider" WhatsApp action when a rider
  // number was actually provided — otherwise the action would dead-end.
  const canSendToRider =
    mode === 'self_fulfillment' && dispatchPhone.length > 0;

  return {
    actionLabel: canSendToRider ? 'Send Order Details to Rider' : '',
    actionVariant: canSendToRider ? 'whatsapp' : 'default',
    message:
      mode === 'self_fulfillment'
        ? 'The order has been marked shipped. Customer notification has been triggered.'
        : providerLabel
          ? `The order has been booked with ${providerLabel} and marked shipped.`
          : 'The order has been marked shipped.',
    showAction: canSendToRider,
    subMessage: canSendToRider
      ? 'You can now send the delivery details to your dispatch rider on WhatsApp.'
      : mode === 'self_fulfillment'
        ? 'Add a rider number on the order anytime to send delivery details on WhatsApp.'
        : 'The customer has been notified of the shipment update.',
    title: mode === 'self_fulfillment' ? 'Order Shipped' : 'Shipment Booked',
  };
}

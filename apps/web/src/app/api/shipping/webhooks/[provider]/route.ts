/**
 * Shipping Webhooks API
 * Receive status updates from shipping providers
 */

import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { mapProviderStatus } from '@/lib/shipping/status-mapper';

// Create a service role client for webhooks (no cookies/auth needed)
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(supabaseUrl, supabaseServiceKey);
}

import crypto from 'node:crypto';
import { notifyOrderStatusChange } from '@/lib/expo-push';
import type {
  NormalizedShipmentStatus,
  ShippingProviderCode,
} from '@/lib/shipping/types';

// =============================================================================
// WEBHOOK VERIFICATION
// =============================================================================

function verifyWebhookSignature(
  provider: string,
  payload: string,
  signature: string | null
): boolean {
  // Each provider has a different webhook secret
  const secrets: Record<string, string | undefined> = {
    gigl: process.env.GIGL_WEBHOOK_SECRET,
    topship: process.env.TOPSHIP_WEBHOOK_SECRET,
  };

  const secret = secrets[provider.toLowerCase()];

  // Security: Fail closed - require webhook secrets in production
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[Webhook] No secret configured for provider in production - rejecting',
        { provider }
      );
      return false;
    }
    // Only allow bypass in development
    console.warn(
      '[Webhook] No secret configured for provider in development - allowing',
      { provider }
    );
    return true;
  }

  if (!signature) {
    console.error('[Webhook] No signature provided', { provider });
    return false;
  }

  // Compute expected signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Security: Handle buffer length mismatch before timingSafeEqual
  // timingSafeEqual throws TypeError if buffers have different lengths
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    console.error('[Webhook] Signature length mismatch', { provider });
    return false;
  }

  // Compare signatures (timing-safe)
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

// =============================================================================
// PROVIDER-SPECIFIC PAYLOAD PARSING
// =============================================================================

interface WebhookEvent {
  trackingNumber: string;
  providerShipmentId?: string;
  status: string;
  description?: string;
  location?: string;
  timestamp: Date;
  rawPayload: unknown;
}

function parseGiglWebhook(payload: unknown): WebhookEvent | null {
  const data = payload as {
    Waybill?: string;
    ShipmentScanStatus?: string;
    Status?: string;
    Description?: string;
    Location?: string;
    ScanDate?: string;
    DateTime?: string;
  };

  if (!data.Waybill) return null;

  return {
    trackingNumber: data.Waybill,
    status: data.ShipmentScanStatus || data.Status || '',
    description: data.Description,
    location: data.Location,
    timestamp: new Date(data.ScanDate || data.DateTime || Date.now()),
    rawPayload: payload,
  };
}

function parseTopshipWebhook(payload: unknown): WebhookEvent | null {
  const data = payload as {
    trackingId?: string;
    shipmentId?: string;
    status?: string;
    description?: string;
    location?: string;
    timestamp?: string;
    createdAt?: string;
  };

  if (!data.trackingId && !data.shipmentId) return null;

  return {
    trackingNumber: data.trackingId || '',
    providerShipmentId: data.shipmentId,
    status: data.status || '',
    description: data.description,
    location: data.location,
    timestamp: new Date(data.timestamp || data.createdAt || Date.now()),
    rawPayload: payload,
  };
}

function parseWebhookPayload(
  provider: string,
  payload: unknown
): WebhookEvent | null {
  switch (provider.toUpperCase()) {
    case 'GIGL':
      return parseGiglWebhook(payload);
    case 'TOPSHIP':
      return parseTopshipWebhook(payload);

    default:
      return null;
  }
}

// =============================================================================
// POST /api/shipping/webhooks/[provider] - Receive webhook
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  try {
    const providerUpper = provider.toUpperCase() as ShippingProviderCode;

    // Read payload
    const payload = await request.text();
    const signature =
      request.headers.get('x-webhook-signature') ||
      request.headers.get('x-signature') ||
      request.headers.get('authorization');

    // Verify signature
    if (!verifyWebhookSignature(provider, payload, signature)) {
      console.error('[Webhook] Invalid signature', { provider });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse payload
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      console.error('[Webhook] Invalid JSON payload', { provider });
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Extract event data
    const event = parseWebhookPayload(provider, parsedPayload);
    if (!event) {
      console.warn('[Webhook] Could not parse payload', {
        provider,
        payload: parsedPayload,
      });
      // Return success to avoid retries for unparseable payloads
      return NextResponse.json({ received: true, parsed: false });
    }

    // Use service role client - webhooks are external, no user cookies
    const supabase = getServiceClient();

    // Store webhook event for debugging
    const { error: insertEventError } = await supabase
      .from('shipping_webhook_events')
      .insert({
        provider: providerUpper,
        event_type: 'status_update',
        tracking_number: event.trackingNumber,
        payload: event.rawPayload,
        processed: false,
      });
    if (insertEventError) {
      console.error(
        'Error inserting shipping webhook event:',
        insertEventError
      );
    }

    // Find shipment by tracking number or provider shipment ID
    let shipmentQuery = supabase
      .from('shipments')
      .select(
        'id, order_id, status, tracking_events, orders(order_number, customer_id, customers(user_id))'
      )
      .eq('provider', providerUpper);

    if (event.trackingNumber) {
      shipmentQuery = shipmentQuery.eq('tracking_number', event.trackingNumber);
    } else if (event.providerShipmentId) {
      shipmentQuery = shipmentQuery.eq(
        'provider_shipment_id',
        event.providerShipmentId
      );
    } else {
      console.warn(`[Webhook] No tracking number or shipment ID in event`);
      return NextResponse.json({
        received: true,
        processed: false,
        reason: 'no_identifier',
      });
    }

    const { data: shipment, error: shipmentError } =
      await shipmentQuery.single();

    if (shipmentError || !shipment) {
      console.warn('[Webhook] Shipment not found', {
        trackingNumber: event.trackingNumber,
      });
      // Mark webhook as processed (no shipment to update)
      await supabase
        .from('shipping_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('tracking_number', event.trackingNumber)
        .eq('provider', providerUpper);

      return NextResponse.json({
        received: true,
        processed: false,
        reason: 'shipment_not_found',
      });
    }

    // Map provider status to normalized status
    const normalizedStatus = mapProviderStatus(providerUpper, event.status);

    // Build new tracking event
    const newEvent = {
      status: event.status,
      normalizedStatus,
      description: event.description,
      location: event.location,
      timestamp: event.timestamp.toISOString(),
      rawStatus: event.status,
    };

    // Update tracking events array
    const existingEvents = Array.isArray(shipment.tracking_events)
      ? shipment.tracking_events
      : [];
    const updatedEvents = [newEvent, ...existingEvents];

    // Update shipment
    const shipmentUpdate: Record<string, unknown> = {
      status: normalizedStatus,
      tracking_events: updatedEvents,
      current_location: event.location,
      last_tracked_at: new Date().toISOString(),
    };

    // Set delivery timestamp if delivered
    if (normalizedStatus === 'delivered') {
      shipmentUpdate.delivered_at = event.timestamp.toISOString();
    }

    await supabase
      .from('shipments')
      .update(shipmentUpdate)
      .eq('id', shipment.id);

    // Update order status
    const orderStatusMap: Record<NormalizedShipmentStatus, string> = {
      pending: 'pending',
      booked: 'shipped',
      pickup_scheduled: 'shipped',
      picked_up: 'shipped',
      in_transit: 'shipped',
      out_for_delivery: 'shipped',
      delivered: 'delivered',
      cancelled: 'cancelled',
      failed: 'failed',
      returned: 'returned',
    };

    await supabase
      .from('orders')
      .update({
        shipping_status: orderStatusMap[normalizedStatus] || 'processing',
      })
      .eq('id', shipment.order_id);

    // Mark webhook as processed
    await supabase
      .from('shipping_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('tracking_number', event.trackingNumber)
      .eq('provider', providerUpper);

    // Send push notification to customer if order has customer with user_id
    // Note: Supabase returns nested relations as arrays, so we access [0]
    const orderData = shipment as unknown as {
      order_id: string;
      orders?: Array<{
        order_number: string;
        customer_id: string;
        customers?: Array<{ user_id: string }>;
      }>;
    };
    const order = orderData.orders?.[0];
    const customerUserId = order?.customers?.[0]?.user_id;

    if (customerUserId && order) {
      const orderStatusForNotification =
        orderStatusMap[normalizedStatus] || normalizedStatus;
      notifyOrderStatusChange(
        customerUserId,
        shipment.order_id,
        order.order_number,
        orderStatusForNotification
      ).catch((err) => {
        console.error('[Webhook] Failed to send push notification:', err);
      });
    }

    console.log('[Webhook] Processed webhook', {
      provider,
      trackingNumber: event.trackingNumber,
      status: normalizedStatus,
    });

    return NextResponse.json({
      received: true,
      processed: true,
      trackingNumber: event.trackingNumber,
      status: normalizedStatus,
    });
  } catch (error) {
    console.error('[Webhook] Error processing webhook', {
      provider,
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

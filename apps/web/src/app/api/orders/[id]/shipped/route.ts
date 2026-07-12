import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { sendOrderFulfillmentNotification } from '@/lib/order-fulfillment-notification';
import type { OrderFulfillmentNotificationResult } from '@/lib/order-fulfillment-notification-types';
import { beginOrderNotificationOutboxDispatch } from '@/lib/order-notification-outbox-dispatch';
import { completeManualOrderNotificationOutboxEvent } from '@/lib/order-notification-outbox-manual-result';
import { getManualOrderNotificationOutboxBlockingState } from '@/lib/order-notification-outbox-manual-state';
import { orderIdParamsSchema } from '@/schemas/orders';

const optionalTrimmedStringSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().optional()
);

const shippedEmailRequestBodySchema = z.strictObject({
  tracking_number: optionalTrimmedStringSchema,
  courier_name: optionalTrimmedStringSchema,
  estimated_delivery: optionalTrimmedStringSchema,
});

function responseForResult(result: OrderFulfillmentNotificationResult) {
  if (result.status === 'sent') {
    return NextResponse.json({
      success: true,
      message: result.message,
      messageId: result.messageId,
    });
  }

  if (result.status === 'skipped') {
    return NextResponse.json({
      success: true,
      message: 'Shipped notification skipped',
      notificationSkipped: true,
      reason: result.reason,
    });
  }

  if (result.status === 'not_found') {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (result.status === 'invalid_state') {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    { error: 'Failed to send email', code: 'NOTIFICATION_SEND_FAILED' },
    { status: 500 }
  );
}

/**
 * POST /api/orders/[id]/shipped
 * Backward-compatible manual send endpoint. Normal shipped notifications are
 * now queued by the order notification outbox when shipping_status changes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }
    const authenticatedSupabase = auth.supabase;

    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) return response as NextResponse;

    let trackingNumber: string | undefined;
    let courierName: string | undefined;
    let estimatedDelivery: string | undefined;

    const rawBody = await request.text();
    if (rawBody.trim().length > 0) {
      let body: unknown;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return NextResponse.json(
          { error: 'Malformed JSON body' },
          { status: 400 }
        );
      }

      const parsedBody = shippedEmailRequestBodySchema.safeParse(body);
      if (!parsedBody.success) {
        return NextResponse.json(
          {
            error: 'Invalid request body',
            details: z.flattenError(parsedBody.error),
          },
          { status: 400 }
        );
      }

      trackingNumber = parsedBody.data.tracking_number;
      courierName = parsedBody.data.courier_name;
      estimatedDelivery = parsedBody.data.estimated_delivery;
    }

    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const parsedParams = orderIdParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: 'Invalid order ID', code: 'INVALID_ORDER_ID' },
        { status: 400 }
      );
    }

    const blockingState = await getManualOrderNotificationOutboxBlockingState({
      courierName,
      estimatedDelivery,
      eventType: 'order_shipped',
      merchantId,
      orderId: parsedParams.data.id,
      supabase: auth.supabase,
      trackingNumber,
    });
    if (blockingState.status === 'error') {
      return NextResponse.json(
        { error: 'Failed to verify notification state' },
        { status: 500 }
      );
    }
    if (blockingState.status === 'not_found') {
      return responseForResult({
        status: 'not_found',
        error: 'Order not found',
      });
    }
    if (blockingState.status === 'invalid_state') {
      return responseForResult({
        status: 'invalid_state',
        error: 'Order must be marked as shipped first',
      });
    }
    if (blockingState.status === 'blocked') {
      switch (blockingState.outboxStatus) {
        case 'outcome_unknown':
          return responseForResult({
            status: 'skipped',
            reason: 'notification_delivery_outcome_unknown',
          });
        case 'sent':
          return responseForResult({
            status: 'skipped',
            reason: 'notification_already_sent',
          });
        case 'pending':
          return responseForResult({
            status: 'skipped',
            reason: 'notification_pending',
          });
        case 'processing':
          return responseForResult({
            status: 'skipped',
            reason: 'notification_processing',
          });
        default: {
          const exhaustive: never = blockingState.outboxStatus;
          return exhaustive;
        }
      }
    }

    let result: OrderFulfillmentNotificationResult;
    try {
      result = await sendOrderFulfillmentNotification({
        beforeProviderDispatch: () =>
          beginOrderNotificationOutboxDispatch({
            claimId: blockingState.claimId,
            eventType: 'order_shipped',
            merchantId,
            orderId: parsedParams.data.id,
            supabase: authenticatedSupabase,
          }),
        courierName,
        estimatedDelivery,
        eventType: 'order_shipped',
        merchantId,
        mismatchBehavior: 'invalid_state',
        orderId: parsedParams.data.id,
        supabase: auth.supabase,
        trackingNumber,
      });
    } catch (error) {
      try {
        await completeManualOrderNotificationOutboxEvent({
          claimId: blockingState.claimId,
          eventType: 'order_shipped',
          merchantId,
          orderId: parsedParams.data.id,
          result: {
            status: 'failed',
            error: 'Notification dispatch failed before completion',
          },
          supabase: auth.supabase,
        });
      } catch (completionError) {
        console.error(
          'Failed to release shipped notification manual claim:',
          completionError
        );
      }
      throw error;
    }

    await completeManualOrderNotificationOutboxEvent({
      claimId: blockingState.claimId,
      eventType: 'order_shipped',
      merchantId,
      orderId: parsedParams.data.id,
      result,
      supabase: auth.supabase,
    });

    return responseForResult(result);
  } catch (error: unknown) {
    console.error('Failed to send shipped order notification:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

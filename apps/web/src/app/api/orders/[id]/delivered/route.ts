import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  type OrderFulfillmentNotificationResult,
  sendOrderFulfillmentNotification,
} from '@/lib/order-fulfillment-notification';
import { completeManualOrderNotificationOutboxEvent } from '@/lib/order-notification-outbox-manual-result';
import { getManualOrderNotificationOutboxBlockingState } from '@/lib/order-notification-outbox-manual-state';
import { orderIdParamsSchema } from '@/schemas/orders';

function responseForResult(result: OrderFulfillmentNotificationResult) {
  if (result.status === 'sent') {
    return NextResponse.json({
      success: true,
      message: result.message,
      messageId: result.messageId,
      hasGoogleRating: result.hasGoogleRating ?? false,
    });
  }

  if (result.status === 'skipped') {
    return NextResponse.json({
      success: true,
      message: 'Delivered notification skipped',
      notificationSkipped: true,
      reason: result.reason,
      hasGoogleRating: result.hasGoogleRating ?? false,
    });
  }

  if (result.status === 'not_found') {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (result.status === 'invalid_state') {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(
    { error: 'Failed to send email', details: result.error },
    { status: 500 }
  );
}

/**
 * POST /api/orders/[id]/delivered
 * Backward-compatible manual send endpoint. Normal delivered notifications are
 * now queued by the order notification outbox when shipping_status changes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const parsedParams = orderIdParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: 'Invalid order ID', code: 'INVALID_ORDER_ID' },
        { status: 400 }
      );
    }

    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const blockingState = await getManualOrderNotificationOutboxBlockingState({
      eventType: 'order_delivered',
      merchantId,
      orderId: parsedParams.data.id,
      supabase: auth.supabase,
    });
    if (blockingState.status === 'error') {
      return NextResponse.json(
        { error: 'Failed to verify notification state' },
        { status: 500 }
      );
    }
    if (blockingState.status === 'blocked') {
      switch (blockingState.outboxStatus) {
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

    const result = await sendOrderFulfillmentNotification({
      eventType: 'order_delivered',
      merchantId,
      mismatchBehavior: 'invalid_state',
      orderId: parsedParams.data.id,
      supabase: auth.supabase,
    });

    await completeManualOrderNotificationOutboxEvent({
      eventType: 'order_delivered',
      merchantId,
      orderId: parsedParams.data.id,
      result,
      supabase: auth.supabase,
    });

    return responseForResult(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

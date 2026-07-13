import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { sendOrderFulfillmentNotification } from '@/lib/order-fulfillment-notification';
import type { OrderFulfillmentNotificationResult } from '@/lib/order-fulfillment-notification-types';
import { beginOrderNotificationOutboxDispatch } from '@/lib/order-notification-outbox-dispatch';
import { resetOrderNotificationOutboxDispatch } from '@/lib/order-notification-outbox-dispatch-reset';
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
    { error: 'Failed to send email', code: 'NOTIFICATION_SEND_FAILED' },
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
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }
    const authenticatedSupabase = auth.supabase;

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
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
    if (blockingState.status === 'not_found') {
      return responseForResult({
        status: 'not_found',
        error: 'Order not found',
      });
    }
    if (blockingState.status === 'invalid_state') {
      return responseForResult({
        status: 'invalid_state',
        error: 'Order must be marked as delivered first',
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
            claimOwner: blockingState.claimOwner,
            eventType: 'order_delivered',
            merchantId,
            orderId: parsedParams.data.id,
            supabase: authenticatedSupabase,
          }),
        resetProviderDispatch: () =>
          resetOrderNotificationOutboxDispatch({
            claimId: blockingState.claimId,
            claimOwner: blockingState.claimOwner,
            eventType: 'order_delivered',
            merchantId,
            orderId: parsedParams.data.id,
            supabase: authenticatedSupabase,
          }),
        eventType: 'order_delivered',
        merchantId,
        mismatchBehavior: 'invalid_state',
        orderId: parsedParams.data.id,
        supabase: auth.supabase,
      });
    } catch (error) {
      try {
        await completeManualOrderNotificationOutboxEvent({
          claimId: blockingState.claimId,
          claimOwner: blockingState.claimOwner,
          eventType: 'order_delivered',
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
          'Failed to release delivered notification manual claim:',
          completionError
        );
      }
      throw error;
    }

    await completeManualOrderNotificationOutboxEvent({
      claimId: blockingState.claimId,
      claimOwner: blockingState.claimOwner,
      eventType: 'order_delivered',
      merchantId,
      orderId: parsedParams.data.id,
      result,
      supabase: auth.supabase,
    });

    return responseForResult(result);
  } catch (error: unknown) {
    console.error('Failed to send delivered order notification:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

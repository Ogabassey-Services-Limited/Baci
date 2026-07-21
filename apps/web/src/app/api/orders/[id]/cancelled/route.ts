import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { ORDER_WITH_ITEMS_QUERY } from '@/lib/order-queries';
import { buildOrderCancellationEmailMessage } from '@/lib/orders/build-order-cancellation-email-message';
import {
  DeliveryUncertainError,
  runOrderCancellationSideEffect,
} from '@/lib/orders/run-order-cancellation-side-effect';
import { initiateRefund as initiatePaystackRefund } from '@/lib/paystack';
import { sendEmail } from '@/lib/zeptomail';
import { merchantOrderCancellationSchema } from '@/schemas/orders';

/**
 * POST /api/orders/[id]/cancelled
 * Sends the "Order Cancelled" email to the customer
 * Called when merchant or customer cancels an order
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const { id } = await params;
    console.log(`[OrderCancelled] Starting for order ${id}`);

    let requestBody: unknown = {};
    try {
      requestBody = await request.json();
    } catch {
      // Validation below rejects missing explicit cancellation confirmation.
    }
    const parsedBody = merchantOrderCancellationSchema.safeParse(requestBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid cancellation request', code: 'INVALID_REQUEST_BODY' },
        { status: 400 }
      );
    }
    const cancellationReason = parsedBody.data.reason;
    const cancelledBy = 'merchant' as const;

    // Authenticate request
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get merchant ID
    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const supabase = auth.supabase;

    const { data: cancellationPerformed, error: cancellationError } =
      await supabase.rpc('cancel_order_as_merchant', {
        p_order_id: id,
        p_reason: cancellationReason,
      });
    if (cancellationError) {
      const status =
        cancellationError.code === 'P0002'
          ? 404
          : cancellationError.code === 'P0001'
            ? 409
            : cancellationError.code === '42501'
              ? 403
              : 500;
      return NextResponse.json(
        {
          error:
            status === 409
              ? 'This order can no longer be cancelled.'
              : status === 404
                ? 'Order not found'
                : status === 403
                  ? 'You do not have permission to cancel this order.'
                  : 'Failed to cancel order',
          code: status === 409 ? 'ORDER_NOT_CANCELLABLE' : undefined,
        },
        { status }
      );
    }
    const alreadyCancelled = !cancellationPerformed;

    // Fetch merchant details
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(
        'id, business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
      )
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`${ORDER_WITH_ITEMS_QUERY}, cancelled_at`)
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if order is actually cancelled
    if (
      !['cancelled', 'canceled'].includes(order.shipping_status) &&
      !order.cancelled_at
    ) {
      return NextResponse.json(
        { error: 'Order must be marked as cancelled first' },
        { status: 400 }
      );
    }

    // Calculate refund amount
    const amountPaid = Number(order.amount_paid) || 0;
    // For now, assume full refund of amount paid
    const refundAmount = amountPaid;

    // Process actual refund if payment was made
    let refundResult: {
      success: boolean;
      refundId?: number;
      error?: string;
    } = { success: false };
    let refundStatus:
      | 'completed'
      | 'deferred'
      | 'failed'
      | 'delivery_uncertain'
      | 'not_required' = 'not_required';
    if (amountPaid > 0 && order.payment_status === 'paid') {
      refundStatus = await runOrderCancellationSideEffect({
        orderId: id,
        step: 'refund',
        supabase,
        execute: async () => {
          const { data: transaction } = await supabase
            .from('transactions')
            .select('gateway, gateway_reference')
            .eq('order_id', id)
            .eq('transaction_type', 'payment')
            .eq('status', 'completed')
            .single();
          if (!transaction?.gateway_reference) {
            throw new Error('No completed payment transaction found');
          }
          if (transaction.gateway !== 'paystack') {
            throw new Error(`Unsupported gateway: ${transaction.gateway}`);
          }

          const paystackRefund = await initiatePaystackRefund(
            transaction.gateway_reference,
            refundAmount * 100,
            cancellationReason || 'Order cancelled'
          );
          if (!paystackRefund.success) {
            const isAmbiguousFailure =
              paystackRefund.code === 'NETWORK_ERROR' ||
              paystackRefund.code?.startsWith('HTTP_5');
            const RefundError = isAmbiguousFailure
              ? DeliveryUncertainError
              : Error;
            throw new RefundError(paystackRefund.error);
          }

          refundResult = {
            success: true,
            refundId: paystackRefund.data.id,
          };
          const { error: insertTxError } = await supabase
            .from('transactions')
            .insert({
              merchant_id: order.merchant_id,
              order_id: id,
              transaction_type: 'refund',
              amount: refundAmount,
              currency: order.currency || 'NGN',
              status: 'completed',
              gateway: transaction.gateway,
              gateway_reference: String(paystackRefund.data.id),
              description: `Refund for cancelled order #${order.order_number || id.slice(0, 8)}`,
            });
          if (insertTxError) {
            throw new DeliveryUncertainError(
              'Refund succeeded but its local audit record failed'
            );
          }
          return { refundId: paystackRefund.data.id };
        },
      });
      refundResult.success = refundStatus === 'completed';
      if (!refundResult.success) refundResult.error = refundStatus;
    }

    let messageId: string | undefined;
    const emailStatus = await runOrderCancellationSideEffect({
      orderId: id,
      step: 'customer_email',
      supabase,
      execute: async () => {
        const emailResult = await sendEmail(
          buildOrderCancellationEmailMessage({
            cancelledBy,
            merchant,
            order,
            reason: cancellationReason,
            refundAmount,
          })
        );
        if (!emailResult.success) {
          throw new Error(emailResult.error || 'Failed to send email');
        }
        messageId = emailResult.messageId;
        return { messageId: emailResult.messageId };
      },
    });

    if (refundStatus === 'failed' || emailStatus === 'failed') {
      return NextResponse.json(
        {
          success: false,
          cancellationSucceeded: true,
          alreadyCancelled,
          error: 'Cancellation completed, but a side effect must be retried',
          sideEffects: { refund: refundStatus, customerEmail: emailStatus },
        },
        { status: 500 }
      );
    }

    const sideEffectsPending =
      refundStatus === 'deferred' ||
      refundStatus === 'delivery_uncertain' ||
      emailStatus === 'deferred' ||
      emailStatus === 'delivery_uncertain';
    return NextResponse.json(
      {
        success: true,
        alreadyCancelled,
        message: sideEffectsPending
          ? 'Cancellation completed; side effects are pending'
          : 'Cancellation notification sent',
        messageId,
        sideEffects: { refund: refundStatus, customerEmail: emailStatus },
        refund:
          amountPaid > 0
            ? {
                attempted: true,
                success: refundResult.success,
                amount: refundAmount,
                refundId: refundResult.refundId,
                error: refundResult.error,
              }
            : {
                attempted: false,
                reason: 'No payment to refund',
              },
      },
      { status: sideEffectsPending ? 202 : 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Error';
    console.error('Error in cancellation notification:', error);
    logger.error({ message: 'Error sending cancellation email', error });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

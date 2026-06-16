import { after, type NextRequest, NextResponse } from 'next/server';
import {
  type CreditDirectWebhookPayload,
  calculateMerchantAmount,
  calculatePlatformFee,
  getWebhookSecret,
  parseWebhookPayload,
  verifyWebhookSignature,
} from '@/lib/credit-direct';
import { notifyNewOrder, notifyPaymentReceived } from '@/lib/expo-push';
import { logger } from '@/lib/logger';
import {
  ensurePaidOrderInventoryConfirmed,
  rollbackOrderStatusAfterInventoryConfirmationFailure,
} from '@/lib/payments/ensure-paid-order-inventory-confirmed';
import { fileInventoryConfirmationFailureReview } from '@/lib/payments/file-inventory-confirmation-review';
import {
  handlePaymentForCancelledOrder,
  isOrderClampedAsCancelled,
} from '@/lib/payments/handle-payment-for-cancelled-order';
import { buildInventoryConfirmationFailurePayload } from '@/lib/payments/inventory-confirmation-response';
import { createServiceClient } from '@/lib/supabase/service';

function readNoteString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * POST /api/payments/credit-direct/webhook
 *
 * Handles Credit Direct BNPL webhook notifications.
 *
 * Events:
 * - Checkout_Customer_Payment_Completed: Customer finished BNPL checkout
 * - Checkout_Merchant_Payment_Completed: Credit Direct paid the merchant
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    // Verify webhook signature
    let webhookSecret: string;
    try {
      webhookSecret = getWebhookSecret();
    } catch {
      logger.error({ message: 'Credit Direct webhook secret not configured' });
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Local webhook testing can omit provider headers, but production fails closed.
    const isDev = process.env.NODE_ENV === 'development';
    const hasProviderSignatureHeaders = Boolean(
      svixId || svixTimestamp || svixSignature
    );
    if (!isDev || hasProviderSignatureHeaders) {
      const isValid = verifyWebhookSignature({
        rawBody,
        secret: webhookSecret,
        svixId,
        svixTimestamp,
        svixSignature,
      });
      if (!isValid) {
        logger.warn({ message: 'Invalid Credit Direct webhook signature' });
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Parse the webhook payload
    let payload: CreditDirectWebhookPayload;
    try {
      const parsed = JSON.parse(rawBody);
      const validated = parseWebhookPayload(parsed);
      if (!validated) {
        logger.warn({
          message: 'Invalid Credit Direct webhook payload structure',
          payload: parsed,
        });
        return NextResponse.json(
          { error: 'Invalid payload structure' },
          { status: 400 }
        );
      }
      payload = validated;
    } catch {
      logger.error({ message: 'Failed to parse Credit Direct webhook body' });
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    logger.info({
      message: 'Credit Direct webhook received',
      eventType: payload.eventType,
      transactionId: payload.checkoutTransactionId,
    });

    // Get Supabase service client (bypasses RLS)
    const supabase = createServiceClient();

    // Find the order by Credit Direct transaction ID
    // We store this in order notes when the checkout is initiated
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, merchant_id, total, payment_status, shipping_status, payment_method, customer_email, customer_name, order_number, notes'
      )
      .in('payment_method', ['credit_direct', 'klump'])
      .ilike('notes', `%${payload.checkoutTransactionId}%`);

    if (orderError) {
      logger.error({
        message: 'Failed to find order for Credit Direct webhook',
        error: orderError,
        transactionId: payload.checkoutTransactionId,
      });
      return NextResponse.json(
        { error: 'Failed to find order' },
        { status: 500 }
      );
    }

    // Try to find by metaData (orderId) if notes search fails
    let order: {
      id: string;
      merchant_id: string;
      total: number;
      payment_status: string;
      shipping_status: string | null;
      payment_method: string | null;
      customer_email: string;
      customer_name: string;
      order_number: string | null;
      notes: string | null;
    } | null = orders?.[0] ?? null;

    if (!order && payload.metaData) {
      const { data: orderById } = await supabase
        .from('orders')
        .select(
          'id, merchant_id, total, payment_status, shipping_status, payment_method, customer_email, customer_name, order_number, notes'
        )
        .eq('id', payload.metaData)
        .single();
      if (orderById) {
        order = orderById;
      }
    }

    if (!order) {
      logger.warn({
        message: 'Order not found for Credit Direct webhook',
        transactionId: payload.checkoutTransactionId,
        metaData: payload.metaData,
      });
      // Return 200 to prevent retries - order might have been cancelled
      return NextResponse.json({ received: true, warning: 'Order not found' });
    }

    let parsedNotes: Record<string, unknown> = {};
    try {
      parsedNotes = JSON.parse(order.notes || '{}') as Record<string, unknown>;
    } catch {
      parsedNotes = {};
    }
    const activeTransactionId =
      readNoteString(parsedNotes.creditDirectTransactionId) ??
      readNoteString(parsedNotes.credit_directTransactionId);
    const activeSessionId = readNoteString(parsedNotes.creditDirectSessionId);
    const activeReference = activeTransactionId ?? activeSessionId;

    if (
      order.payment_method !== 'credit_direct' ||
      activeReference !== payload.checkoutTransactionId
    ) {
      logger.warn({
        message: 'Ignoring stale Credit Direct webhook for inactive session',
        orderId: order.id,
        orderPaymentMethod: order.payment_method,
        activeReference,
        transactionId: payload.checkoutTransactionId,
      });
      return NextResponse.json({
        received: true,
        warning: 'Stale Credit Direct session',
      });
    }

    const signedAmount =
      typeof parsedNotes.creditDirectSignedAmount === 'number'
        ? parsedNotes.creditDirectSignedAmount
        : null;

    // Idempotency: If order is already paid, skip processing (webhook retry)
    if (
      order.payment_status === 'paid' &&
      payload.eventType === 'Checkout_Merchant_Payment_Completed'
    ) {
      logger.info({
        message: 'Credit Direct webhook already processed (order already paid)',
        orderId: order.id,
        transactionId: payload.checkoutTransactionId,
      });
      return NextResponse.json({
        received: true,
        message: 'Already processed',
      });
    }

    // Handle based on event type
    switch (payload.eventType) {
      case 'Checkout_Customer_Payment_Completed': {
        // Customer has completed the BNPL checkout process
        // Update order status to indicate BNPL approval
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'bnpl_approved',
            notes: JSON.stringify({
              ...parsedNotes,
              creditDirectTransactionId: payload.checkoutTransactionId,
              creditDirectCustomer: payload.checkoutCustomer,
              bnplApprovedAt: payload.timeStamp,
            }),
          })
          .eq('id', order.id);

        if (updateError) {
          logger.error({
            message: 'Failed to update order for customer payment completion',
            error: updateError,
          });
          return NextResponse.json(
            { error: 'Failed to update order' },
            { status: 500 }
          );
        }

        try {
          await ensurePaidOrderInventoryConfirmed(
            supabase,
            order.merchant_id,
            order.id
          );
        } catch (inventoryError) {
          logger.error({
            message:
              'Credit-direct webhook customer branch failed to confirm inventory',
            orderId: order.id,
            error: inventoryError,
          });
          return NextResponse.json(
            {
              error:
                inventoryError instanceof Error
                  ? inventoryError.message
                  : 'Inventory confirmation failed',
            },
            { status: 409 }
          );
        }

        logger.info({
          message: 'Credit Direct BNPL approved for customer',
          orderId: order.id,
          transactionId: payload.checkoutTransactionId,
        });

        break;
      }

      case 'Checkout_Merchant_Payment_Completed': {
        // Credit Direct has paid the merchant in full
        // Mark order as fully paid and create transaction record
        const webhookTotal = payload.products.reduce(
          (sum, product) => sum + product.productAmount,
          0
        );
        const expectedAmount = signedAmount ?? (Number(order.total) || 0);
        if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
          logger.error({
            message: 'Invalid expected amount for Credit Direct payment',
            orderId: order.id,
            expectedAmount,
          });
          return NextResponse.json(
            { error: 'Invalid payment amount' },
            { status: 400 }
          );
        }
        if (
          webhookTotal > 0 &&
          Math.abs(webhookTotal - expectedAmount) > 0.01
        ) {
          logger.error({
            message: 'BNPL amount does not match expected total',
            orderId: order.id,
            webhookTotal,
            expectedAmount,
          });
          return NextResponse.json(
            { error: 'Payment amount mismatch' },
            { status: 400 }
          );
        }

        const totalAmount = expectedAmount;
        const platformFee = calculatePlatformFee(totalAmount);
        const merchantAmount = calculateMerchantAmount(totalAmount);

        // Update order to paid status
        const { data: updatedOrder, error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            notes: JSON.stringify({
              ...parsedNotes,
              merchantPaidAt: payload.timeStamp,
              platformFee,
              merchantAmount,
            }),
          })
          .eq('id', order.id)
          .select('id, payment_status, shipping_status, cancelled_at')
          .maybeSingle();

        if (updateError) {
          logger.error({
            message: 'Failed to update order for merchant payment',
            error: updateError,
          });
          return NextResponse.json(
            { error: 'Failed to update order' },
            { status: 500 }
          );
        }

        // Record the captured Credit Direct money first (idempotent), so the
        // disbursed BNPL funds are persisted whether or not the order was
        // cancelled before this webhook landed.
        let recordedTransactionId: string | null = null;
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('id')
          .eq('gateway_reference', payload.checkoutTransactionId)
          .eq('gateway', 'credit_direct')
          .single();

        if (existingTx) {
          recordedTransactionId = existingTx.id;
          logger.info({
            message: 'Credit Direct transaction already processed (idempotent)',
            transactionId: payload.checkoutTransactionId,
            existingTxId: existingTx.id,
          });
        } else {
          // Create transaction record
          const { data: insertedTx, error: txError } = await supabase
            .from('transactions')
            .insert({
              merchant_id: order.merchant_id,
              order_id: order.id,
              transaction_type: 'payment',
              amount: totalAmount,
              currency: 'NGN',
              status: 'completed',
              gateway: 'credit_direct',
              gateway_reference: payload.checkoutTransactionId,
              gateway_response: payload,
              platform_fee: platformFee,
              merchant_amount: merchantAmount,
            })
            .select('id')
            .single();

          if (txError) {
            logger.error({
              message: 'Failed to create transaction record',
              error: txError,
            });
            // Don't fail the webhook - order is already updated
          } else {
            recordedTransactionId = insertedTx?.id ?? null;
          }
        }

        // The prevent_cancelled_order_reopen trigger clamped this reopen:
        // suppress the push + confirmation email and file a reconciliation row
        // linked to the recorded (disbursed) transaction. Ack Credit Direct 200.
        if (updatedOrder && isOrderClampedAsCancelled(updatedOrder)) {
          await handlePaymentForCancelledOrder({
            gatewayReference: payload.checkoutTransactionId,
            order: updatedOrder,
            reason:
              'Credit Direct payment captured for an order cancelled before finalization',
            transactionId: recordedTransactionId,
          });

          return NextResponse.json({
            received: true,
            message: 'Order was cancelled; payment filed for review',
          });
        }

        try {
          await ensurePaidOrderInventoryConfirmed(
            supabase,
            order.merchant_id,
            order.id
          );
        } catch (inventoryError) {
          logger.error({
            message:
              'Credit-direct webhook merchant branch failed to confirm inventory',
            orderId: order.id,
            error: inventoryError,
          });

          try {
            await rollbackOrderStatusAfterInventoryConfirmationFailure(
              supabase,
              order.merchant_id,
              order.id,
              {
                payment_status: order.payment_status ?? null,
                shipping_status: order.shipping_status ?? null,
              }
            );
          } catch (rollbackError) {
            await fileInventoryConfirmationFailureReview({
              gatewayReference: payload.checkoutTransactionId,
              merchantId: order.merchant_id,
              metadata: {
                inventoryError:
                  inventoryError instanceof Error
                    ? inventoryError.message
                    : inventoryError,
                rollbackError:
                  rollbackError instanceof Error
                    ? rollbackError.message
                    : rollbackError,
                source: 'credit_direct_inventory_confirmation_rollback',
              },
              orderId: order.id,
              reason:
                'Credit Direct merchant payment reached paid state, but serialized inventory confirmation and status rollback both failed.',
              transactionId: recordedTransactionId,
            });
            return NextResponse.json(
              {
                code: 'INVENTORY_CONFIRMATION_CLEANUP_FAILED',
                error: 'Inventory confirmation cleanup failed',
              },
              { status: 500 }
            );
          }

          const responsePayload =
            buildInventoryConfirmationFailurePayload(inventoryError);
          return NextResponse.json(responsePayload, {
            status:
              responsePayload.code === 'serialized_inventory_unavailable'
                ? 409
                : 500,
          });
        }

        // Notify merchant of new order and payment (non-blocking)
        after(async () => {
          const orderNum =
            order.order_number || order.id.slice(0, 8).toUpperCase();

          try {
            await notifyNewOrder(
              order.merchant_id,
              order.id,
              orderNum,
              order.customer_name || 'Customer',
              totalAmount
            );
          } catch (err) {
            logger.error({
              message: 'New order push notification failed',
              error: err,
            });
          }

          try {
            await notifyPaymentReceived(
              order.merchant_id,
              totalAmount,
              'NGN',
              orderNum,
              order.id
            );
          } catch (err) {
            logger.error({
              message: 'Payment received push notification failed',
              error: err,
            });
          }
        });

        // Send confirmation email
        try {
          await sendOrderConfirmationEmail(order, payload);
        } catch (emailError) {
          logger.warn({
            message: 'Failed to send confirmation email',
            error: emailError,
          });
          // Don't fail webhook for email errors
        }

        logger.info({
          message: 'Credit Direct merchant payment completed',
          orderId: order.id,
          transactionId: payload.checkoutTransactionId,
          amount: totalAmount,
          platformFee,
          merchantAmount,
        });

        break;
      }

      default: {
        logger.warn({
          message: 'Unknown Credit Direct webhook event type',
          eventType: payload.eventType,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error({
      message: 'Credit Direct webhook error',
      error,
    });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Send order confirmation email after successful payment
 */
async function sendOrderConfirmationEmail(
  order: {
    id: string;
    merchant_id?: string | null;
    customer_id?: string | null;
    customer_email: string;
    customer_name: string;
    total: number;
  },
  payload: CreditDirectWebhookPayload
) {
  // Import email sending function
  const { sendEmail } = await import('@/lib/zeptomail');

  const emailResult = await sendEmail({
    to: order.customer_email,
    toName: order.customer_name,
    subject: `Order Confirmed - Thank you for your purchase!`,
    htmlContent: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Order Confirmed!</h1>
        <p>Hi ${payload.checkoutCustomer.firstName || order.customer_name || 'there'},</p>
        <p>Great news! Your order has been confirmed and is being processed.</p>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Order Total:</strong> ₦${Number(order.total).toLocaleString()}</p>
          <p style="margin: 10px 0 0;"><strong>Payment Method:</strong> Credit Direct BNPL</p>
        </div>

        <h3>Items Purchased:</h3>
        <ul>
          ${payload.products.map((p) => `<li>${p.productName} - ₦${p.productAmount.toLocaleString()}</li>`).join('')}
        </ul>

        <p>We'll send you another email when your order ships.</p>

        <p style="color: #666; font-size: 14px;">Thank you for shopping with us!</p>
      </div>
    `,
    auditContext: {
      merchantId: order.merchant_id,
      orderId: order.id,
      customerId: order.customer_id,
      metadata: {
        trigger: 'credit_direct_payment_confirmation',
      },
    },
  });

  if (!emailResult.success) {
    throw new Error(
      emailResult.error || 'Credit Direct confirmation email was not sent'
    );
  }
}

// Ensure webhook route is not cached

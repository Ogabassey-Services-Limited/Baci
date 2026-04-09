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
import { createServiceClient } from '@/lib/supabase/service';

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
    const signature = request.headers.get('x-creditdirect-signature') || '';

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

    // Skip signature verification in development if no signature provided
    const isDev = process.env.NODE_ENV === 'development';
    if (signature && !isDev) {
      const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
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
        'id, merchant_id, total, payment_status, customer_email, customer_name, order_number, notes'
      )
      .eq('payment_method', 'credit_direct')
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
      customer_email: string;
      customer_name: string;
      order_number: string | null;
      notes: string | null;
    } | null = orders?.[0] ?? null;

    if (!order && payload.metaData) {
      const { data: orderById } = await supabase
        .from('orders')
        .select(
          'id, merchant_id, total, payment_status, customer_email, customer_name, order_number, notes'
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
              ...JSON.parse(order.notes || '{}'),
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
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            notes: JSON.stringify({
              ...JSON.parse(order.notes || '{}'),
              merchantPaidAt: payload.timeStamp,
              platformFee,
              merchantAmount,
            }),
          })
          .eq('id', order.id);

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

        // Idempotency check: Skip if transaction already exists (webhook retry)
        const { data: existingTx } = await supabase
          .from('transactions')
          .select('id')
          .eq('gateway_reference', payload.checkoutTransactionId)
          .eq('gateway', 'credit_direct')
          .single();

        if (existingTx) {
          logger.info({
            message: 'Credit Direct transaction already processed (idempotent)',
            transactionId: payload.checkoutTransactionId,
            existingTxId: existingTx.id,
          });
        } else {
          // Create transaction record
          const { error: txError } = await supabase
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
            });

          if (txError) {
            logger.error({
              message: 'Failed to create transaction record',
              error: txError,
            });
            // Don't fail the webhook - order is already updated
          }
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
  });

  if (!emailResult.success) {
    throw new Error(
      emailResult.error || 'Credit Direct confirmation email was not sent'
    );
  }
}

// Ensure webhook route is not cached

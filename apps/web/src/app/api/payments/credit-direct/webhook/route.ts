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
import { escapeHtmlText } from '@/lib/sanitize';
import { createServiceClient } from '@/lib/supabase/service';

function readNoteString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readProductAmount(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim()) {
    const amount = Number(value.trim());
    return Number.isFinite(amount) ? amount : null;
  }

  return null;
}

function getWebhookProductsTotal(
  products: CreditDirectWebhookPayload['products']
) {
  let total = 0;

  for (const product of products) {
    const amount = readProductAmount(product.productAmount);
    if (amount === null) {
      return null;
    }
    total += amount;
  }

  return total;
}

function formatCreditDirectProductAmount(value: unknown) {
  const amount = readProductAmount(value);
  if (amount === null) {
    return escapeHtmlText(String(value ?? ''));
  }

  return escapeHtmlText(amount.toLocaleString());
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
        'id, merchant_id, total, amount_paid, wallet_amount_used, payment_status, shipping_status, payment_method, customer_email, customer_name, order_number, notes'
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
      amount_paid: number | string | null;
      wallet_amount_used: number | string | null;
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
          'id, merchant_id, total, amount_paid, wallet_amount_used, payment_status, shipping_status, payment_method, customer_email, customer_name, order_number, notes'
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

    const matchesActiveReference =
      activeReference === payload.checkoutTransactionId;
    // The launcher persists the popup transaction id best-effort; if that
    // write failed (e.g. the WebView navigated away mid-flight), notes still
    // hold only the sign-time session id. Accept the payload for this order
    // when no popup reference was ever persisted and the webhook's metaData
    // names this order — but positively exclude references retained from
    // superseded sessions (set_credit_direct_session keeps them in
    // creditDirectSupersededReferences on every re-sign) and payloads whose
    // event time predates the current session's signing, so a retried
    // checkout cannot have a stale session's webhook clobber the live one.
    const supersededReferences = Array.isArray(
      parsedNotes.creditDirectSupersededReferences
    )
      ? parsedNotes.creditDirectSupersededReferences.filter(
          (value): value is string => typeof value === 'string'
        )
      : [];
    const isSupersededReference = supersededReferences.includes(
      payload.checkoutTransactionId
    );
    const signedAtMs = Date.parse(
      readNoteString(parsedNotes.creditDirectSignedAt) ?? ''
    );
    const payloadTimeMs = Date.parse(payload.timeStamp);
    const CLOCK_SKEW_TOLERANCE_MS = 5 * 60_000;
    const predatesCurrentSession =
      Number.isFinite(signedAtMs) &&
      Number.isFinite(payloadTimeMs) &&
      payloadTimeMs < signedAtMs - CLOCK_SKEW_TOLERANCE_MS;
    const acceptsUnpersistedPopupReference =
      activeTransactionId === null &&
      activeSessionId !== null &&
      payload.metaData === order.id &&
      !isSupersededReference &&
      !predatesCurrentSession;

    if (
      order.payment_method !== 'credit_direct' ||
      (!matchesActiveReference && !acceptsUnpersistedPopupReference)
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

    if (!matchesActiveReference && acceptsUnpersistedPopupReference) {
      logger.info({
        message:
          'Accepting Credit Direct webhook without a persisted popup reference',
        orderId: order.id,
        activeSessionId,
        transactionId: payload.checkoutTransactionId,
      });
    }

    const signedAmount =
      typeof parsedNotes.creditDirectSignedAmount === 'number'
        ? parsedNotes.creditDirectSignedAmount
        : null;

    const customerPaymentAlreadyApproved =
      payload.eventType === 'Checkout_Customer_Payment_Completed' &&
      (order.payment_status === 'bnpl_approved' ||
        order.payment_status === 'paid');

    if (customerPaymentAlreadyApproved) {
      logger.info({
        message:
          'Credit Direct customer payment webhook already approved; retrying inventory confirmation',
        orderId: order.id,
        transactionId: payload.checkoutTransactionId,
      });
    }

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
        if (!customerPaymentAlreadyApproved) {
          // Customer has completed the BNPL checkout process.
          const { data: updatedOrder, error: updateError } = await supabase
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
            .eq('id', order.id)
            .in('payment_status', ['pending', 'bnpl_pending'])
            .select('id')
            .maybeSingle();

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

          if (!updatedOrder) {
            logger.warn({
              message:
                'Credit Direct customer payment update skipped because order status is no longer eligible',
              orderId: order.id,
              currentPaymentStatus: order.payment_status,
              transactionId: payload.checkoutTransactionId,
            });
            return NextResponse.json({
              received: true,
              warning: 'Order status no longer eligible',
            });
          }
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
        const webhookTotal = getWebhookProductsTotal(payload.products);
        // Anchor the payout validation to server-owned order columns. The
        // signed amount in notes is written by an anon-callable RPC, so it
        // must not decide how much money marks this order as paid. Wallet or
        // savings redemptions settle before the gateway leg (recorded as
        // amount_paid / wallet_amount_used at order creation), so Credit
        // Direct legitimately collects the residual — not always the full
        // order total.
        const orderTotal = Number(order.total) || 0;
        const preGatewayPaid = Math.max(
          Number(order.amount_paid) || 0,
          Number(order.wallet_amount_used) || 0
        );
        const expectedAmount =
          Math.round((orderTotal - preGatewayPaid) * 100) / 100;
        if (
          signedAmount !== null &&
          Math.abs(signedAmount - expectedAmount) > 0.01
        ) {
          logger.warn({
            message: 'Credit Direct signed amount drifted from order total',
            orderId: order.id,
            signedAmount,
            orderTotal: expectedAmount,
            transactionId: payload.checkoutTransactionId,
          });
        }
        if (webhookTotal === null) {
          logger.error({
            message: 'Invalid Credit Direct webhook product amount',
            orderId: order.id,
            transactionId: payload.checkoutTransactionId,
          });
          return NextResponse.json(
            { error: 'Invalid payment amount' },
            { status: 400 }
          );
        }
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
            // Fully settled: pre-gateway redemption + gateway residual =
            // the order total. Keeps balance math (total - amount_paid)
            // truthful for receipts and reminders.
            amount_paid: orderTotal,
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
          // The reopen trigger clamps the status fields but not amount_paid;
          // restore it so a duplicate webhook still resolves the expected
          // residual instead of failing amount validation forever.
          const { error: amountRestoreError } = await supabase
            .from('orders')
            .update({ amount_paid: order.amount_paid ?? 0 })
            .eq('id', order.id);
          if (amountRestoreError) {
            logger.warn({
              message:
                'Failed to restore amount_paid on cancelled Credit Direct order',
              orderId: order.id,
              error: amountRestoreError,
            });
          }

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
                // The paid update above set amount_paid to the order total;
                // restore the pre-webhook value so a retried payout does not
                // validate against a zero residual.
                amount_paid: order.amount_paid ?? 0,
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
  const greetingName = escapeHtmlText(
    payload.checkoutCustomer.firstName || order.customer_name || 'there'
  );
  const productItems = payload.products
    .map(
      (product) =>
        `<li>${escapeHtmlText(product.productName)} - ₦${formatCreditDirectProductAmount(product.productAmount)}</li>`
    )
    .join('');

  const emailResult = await sendEmail({
    to: order.customer_email,
    toName: order.customer_name,
    subject: `Order Confirmed - Thank you for your purchase!`,
    htmlContent: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Order Confirmed!</h1>
        <p>Hi ${greetingName},</p>
        <p>Great news! Your order has been confirmed and is being processed.</p>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Order Total:</strong> ₦${Number(order.total).toLocaleString()}</p>
          <p style="margin: 10px 0 0;"><strong>Payment Method:</strong> Credit Direct BNPL</p>
        </div>

        <h3>Items Purchased:</h3>
        <ul>
          ${productItems}
        </ul>

        <p>We'll send you another email when your order ships.</p>

        <p style="color: #666; font-size: 14px;">Thank you for shopping with us!</p>
      </div>
    `,
    emailType: 'orders',
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

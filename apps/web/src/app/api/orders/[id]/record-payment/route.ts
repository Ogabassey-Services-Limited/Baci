import type { PaymentStatus, ShippingStatus } from '@baci/shared';
import type { PostgrestError } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
  generatePaymentReceiptEmail,
  generatePaymentReceiptText,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { ORDER_WITH_ITEMS_QUERY } from '@/lib/order-queries';
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
import { createLegacyManualPaymentFingerprint } from '@/lib/payments/manual-payment-idempotency';
import { runManualPaymentSideEffect } from '@/lib/payments/run-manual-payment-side-effect';
import { triggerPurchaseConversion } from '@/lib/trigger-purchase-conversion';
import { sendEmail } from '@/lib/zeptomail';
import {
  recordPaymentBodySchema,
  recordPaymentOrderIdSchema,
} from '@/schemas/record-payment';

/** Order item interface for email templates (2026 best practice) */
interface EmailOrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface RecordManualPaymentResult {
  cancelled_at?: string | null;
  current_paid?: number | string | null;
  error_code?: string | null;
  idempotency_replayed?: boolean | null;
  new_paid?: number | string | null;
  order_total?: number | string | null;
  payment_status?: PaymentStatus | null;
  previous_amount_paid?: number | string | null;
  previous_payment_status?: PaymentStatus | null;
  previous_shipping_status?: ShippingStatus | null;
  remaining_balance?: number | string | null;
  shipping_status?: ShippingStatus | null;
  total_paid_before?: number | string | null;
  transaction_id?: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) return response as NextResponse;

    const { id } = await params;
    logger.info({ message: 'RecordPayment starting', orderId: id });

    // 1. Auth check FIRST — before processing any user input
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      logger.warn({
        message: 'RecordPayment auth failed',
        error: auth.error,
        orderId: id,
      });
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = auth.user;
    const supabase = auth.supabase;

    const parsedOrderId = recordPaymentOrderIdSchema.safeParse(id);
    if (!parsedOrderId.success) {
      logger.warn({
        message: 'RecordPayment invalid order id',
        orderId: id,
      });
      return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
    }

    const orderId = parsedOrderId.data;

    // 2. Parse and validate request body (before any DB calls)
    let body: unknown;

    try {
      body = await request.json();
    } catch (error) {
      logger.warn({
        message: 'RecordPayment invalid JSON body',
        error,
        orderId,
      });
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsedBody = recordPaymentBodySchema.safeParse(body);
    if (!parsedBody.success) {
      logger.warn({
        message: 'RecordPayment invalid request body',
        orderId,
        details: parsedBody.error.flatten(),
      });
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const parsedAmount = Number(parsedBody.data.amount);
    const { idempotency_key, payment_method, reference, notes } =
      parsedBody.data;
    logger.info({
      message: 'RecordPayment body parsed',
      amount: parsedAmount,
      payment_method,
      orderId,
    });

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // 3. Get merchant ID (supports both owners and staff members)
    const merchantId = await getMerchantIdForApiUser(supabase);
    if (!merchantId) {
      logger.error({
        message: 'RecordPayment merchant not found',
        userId: user.id,
        orderId,
      });
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Fetch independent tenant-scoped records concurrently. Transactions are
    // read only after the order itself is verified below because
    // transactions.merchant_id is denormalized and can drift from orders.
    const [merchantResult, orderResult] = await Promise.all([
      supabase
        .from('merchants')
        .select(
          'id, business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
        )
        .eq('id', merchantId)
        .single(),
      supabase
        .from('orders')
        .select(ORDER_WITH_ITEMS_QUERY)
        .eq('id', orderId)
        .eq('merchant_id', merchantId)
        .single(),
    ]);

    const { data: merchant, error: merchantError } = merchantResult;
    const { data: order, error: orderError } = orderResult;

    if (merchantError && merchantError.code !== 'PGRST116') {
      logger.error({
        message: 'RecordPayment merchant details error',
        error: merchantError,
        merchantId,
        orderId,
      });
      return NextResponse.json(
        { error: 'Failed to fetch merchant details' },
        { status: 500 }
      );
    }

    if (!merchant) {
      logger.error({
        message: 'RecordPayment merchant not found',
        merchantId,
        orderId,
      });
      return NextResponse.json(
        { error: 'Merchant details not found' },
        { status: 404 }
      );
    }

    if (orderError && orderError.code !== 'PGRST116') {
      logger.error({
        message: 'RecordPayment order lookup error',
        error: orderError,
        orderId,
        merchantId,
      });
      return NextResponse.json(
        { error: 'Failed to fetch order' },
        { status: 500 }
      );
    }

    if (!order) {
      logger.error({
        message: 'RecordPayment order not found',
        error: orderError,
        orderId,
        merchantId,
      });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // The RPC is the authoritative balance and idempotency boundary. Keeping
    // replay detection ahead of mutable payment guards inside the same lock
    // allows a timed-out request to succeed even if order state changed later.
    const paymentDescription =
      notes ||
      (payment_method
        ? `Manual payment (${payment_method})`
        : 'Manual payment');
    const legacyPaymentFingerprint = idempotency_key
      ? null
      : createLegacyManualPaymentFingerprint({
          amount: parsedAmount,
          merchantId: merchant.id,
          notes,
          orderId,
          paymentMethod: payment_method,
          reference,
          userId: user.id,
        });
    const effectiveIdempotencyKey = idempotency_key ?? crypto.randomUUID();
    const { data: manualPaymentResult, error: transactionError } =
      (await supabase.rpc('record_manual_order_payment', {
        p_amount: parsedAmount,
        p_currency: order.currency || 'NGN',
        p_description: paymentDescription,
        p_gateway_reference: reference ?? null,
        p_idempotency_key: effectiveIdempotencyKey,
        p_merchant_id: merchant.id,
        p_metadata: {
          ...(legacyPaymentFingerprint && {
            legacy_manual_payment_fingerprint: legacyPaymentFingerprint,
          }),
          payment_method: payment_method || 'manual',
          recorded_by: user.email,
        },
        p_order_id: orderId,
      })) as {
        data: RecordManualPaymentResult | null;
        error: PostgrestError | null;
      };

    if (transactionError) {
      logger.error({
        message: 'RecordPayment transaction insert error',
        error: transactionError,
        orderId,
      });
      return NextResponse.json(
        { error: 'Failed to record payment' },
        { status: 500 }
      );
    }

    if (manualPaymentResult?.error_code === 'DUPLICATE_REFERENCE') {
      logger.warn({
        message: 'RecordPayment duplicate reference rejected at DB level',
        orderId,
        merchantId: merchant.id,
        reference,
      });
      return NextResponse.json(
        { error: 'Duplicate payment reference', code: 'DUPLICATE_REFERENCE' },
        { status: 409 }
      );
    }

    if (manualPaymentResult?.error_code === 'INVALID_AMOUNT') {
      logger.warn({
        message: 'RecordPayment rejected by atomic insert: invalid amount',
        amount: parsedAmount,
        merchantId: merchant.id,
        orderId,
      });
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (manualPaymentResult?.error_code === 'INVALID_IDEMPOTENCY_KEY') {
      logger.warn({
        message:
          'RecordPayment rejected by atomic insert: invalid idempotency key',
        merchantId: merchant.id,
        orderId,
      });
      return NextResponse.json(
        { error: 'Invalid idempotency key' },
        { status: 400 }
      );
    }

    if (manualPaymentResult?.error_code === 'INVALID_METADATA') {
      logger.error({
        message: 'RecordPayment rejected by atomic insert: invalid metadata',
        merchantId: merchant.id,
        orderId,
      });
      return NextResponse.json(
        { error: 'Failed to record payment' },
        { status: 500 }
      );
    }

    if (manualPaymentResult?.error_code === 'IDEMPOTENCY_KEY_CONFLICT') {
      logger.warn({
        message: 'RecordPayment idempotency key reused for different payment',
        merchantId: merchant.id,
        orderId,
      });
      return NextResponse.json(
        {
          error: 'Payment request conflicts with an earlier attempt',
          code: 'IDEMPOTENCY_KEY_CONFLICT',
        },
        { status: 409 }
      );
    }

    if (manualPaymentResult?.error_code === 'PENDING_GATEWAY_PAYMENT') {
      logger.warn({
        message:
          'RecordPayment rejected by atomic insert: pending processor transaction',
        merchantId: merchant.id,
        orderId,
      });
      return NextResponse.json(
        {
          error:
            'This order has a pending processor payment. Use payment reconciliation instead.',
          code: 'PENDING_GATEWAY_PAYMENT',
        },
        { status: 409 }
      );
    }

    if (
      manualPaymentResult?.error_code ===
      'ORDER_PAYMENT_RECONCILIATION_REQUIRED'
    ) {
      logger.warn({
        message:
          'RecordPayment rejected by atomic insert: order transaction merchant drift requires reconciliation',
        merchantId: merchant.id,
        orderId,
      });
      return NextResponse.json(
        {
          error:
            'This order has payments that require reconciliation before recording a manual payment.',
          code: 'ORDER_PAYMENT_RECONCILIATION_REQUIRED',
        },
        { status: 409 }
      );
    }

    if (manualPaymentResult?.error_code === 'ORDER_ALREADY_PAID') {
      logger.warn({
        message:
          'RecordPayment rejected by atomic insert: order already fully paid',
        orderId,
        merchantId: merchant.id,
      });
      return NextResponse.json(
        { error: 'Order is already fully paid' },
        { status: 409 }
      );
    }

    if (
      manualPaymentResult?.error_code === 'AMOUNT_EXCEEDS_REMAINING_BALANCE'
    ) {
      logger.warn({
        message:
          'RecordPayment rejected by atomic insert: amount exceeds remaining balance',
        orderId,
        amount: parsedAmount,
        merchantId: merchant.id,
      });
      return NextResponse.json(
        { error: 'Amount exceeds remaining balance' },
        { status: 409 }
      );
    }

    if (manualPaymentResult?.error_code === 'ORDER_NOT_FOUND') {
      logger.warn({
        message: 'RecordPayment atomic insert lost order ownership check',
        orderId,
        merchantId: merchant.id,
      });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (manualPaymentResult?.error_code || !manualPaymentResult) {
      logger.error({
        message: 'RecordPayment atomic insert returned an unexpected result',
        manualPaymentResult,
        orderId,
      });
      return NextResponse.json(
        { error: 'Failed to record payment' },
        { status: 500 }
      );
    }

    const createdTransaction = manualPaymentResult.transaction_id
      ? { id: manualPaymentResult.transaction_id }
      : null;
    const newPaid = Number(manualPaymentResult.new_paid);
    const remainingBalance = Number(manualPaymentResult.remaining_balance);
    const authoritativeOrderTotal = Number(manualPaymentResult.order_total);

    // 5. Consume the authoritative order status written by the RPC.
    // Keeping status mutation inside the same DB transaction as the manual
    // payment insert prevents a slower partial-payment request from overwriting
    // a faster concurrent full-payment request after both RPCs return.
    const rpcPaymentStatus = manualPaymentResult.payment_status ?? null;
    const rpcShippingStatus = manualPaymentResult.shipping_status ?? null;

    if (
      !rpcPaymentStatus ||
      !rpcShippingStatus ||
      !Number.isFinite(newPaid) ||
      !Number.isFinite(remainingBalance) ||
      !Number.isFinite(authoritativeOrderTotal)
    ) {
      logger.error({
        message:
          'CRITICAL: RecordPayment RPC inserted a transaction without returning updated order status',
        manualPaymentResult,
        orderId,
        inconsistentState: true,
      });
      return NextResponse.json(
        { error: 'Failed to record payment' },
        { status: 500 }
      );
    }

    const isFullyPaid = rpcPaymentStatus === 'paid';
    const updates: {
      payment_status?: PaymentStatus;
      shipping_status?: ShippingStatus;
    } = { payment_status: rpcPaymentStatus };

    if (rpcShippingStatus !== order.shipping_status) {
      updates.shipping_status = rpcShippingStatus;
    }

    const updatedOrder = {
      cancelled_at: manualPaymentResult.cancelled_at ?? null,
      id: orderId,
      shipping_status: rpcShippingStatus,
    };

    let orderCancelledByClamp = false;
    if (!createdTransaction?.id && !isOrderClampedAsCancelled(updatedOrder)) {
      logger.error({
        message: 'RecordPayment atomic insert omitted transaction id',
        manualPaymentResult,
        orderId,
      });
      return NextResponse.json(
        { error: 'Failed to record payment' },
        { status: 500 }
      );
    }

    if (isOrderClampedAsCancelled(updatedOrder)) {
      orderCancelledByClamp = true;
      // Link the reconciliation row to the transaction just recorded (matched
      // by reference) so ops can trace the captured money. Falls back to null
      // for a referenceless manual/cash payment.
      let recordedTransactionId: string | null = createdTransaction?.id ?? null;
      if (!recordedTransactionId && reference) {
        const { data: recordedTransaction, error: recordedTransactionError } =
          await supabase
            .from('transactions')
            .select('id')
            .eq('order_id', orderId)
            .eq('merchant_id', merchantId)
            .eq('gateway_reference', reference)
            .maybeSingle();

        if (recordedTransactionError) {
          logger.error({
            message:
              'RecordPayment failed to fetch recorded transaction for cancelled-order reconciliation',
            error: recordedTransactionError,
            orderId,
            merchantId,
            gatewayReference: reference,
          });
        } else {
          recordedTransactionId = recordedTransaction?.id ?? null;
        }
      }
      await handlePaymentForCancelledOrder({
        gatewayReference: reference ?? null,
        order: updatedOrder,
        reason:
          'Manual payment recorded for an order cancelled by the customer before finalization',
        transactionId: recordedTransactionId,
      });
    }

    // Suppress all paid-order side effects (confirmation / receipt emails,
    // offline-conversion events) when the order was clamped as cancelled.
    if (orderCancelledByClamp) {
      logger.warn({
        message:
          'RecordPayment: order was cancelled; suppressing emails and conversions',
        orderId,
      });
      return NextResponse.json({
        success: true,
        amount_paid: parsedAmount,
        idempotency_replayed:
          manualPaymentResult.idempotency_replayed || undefined,
        new_balance: remainingBalance,
        updated_status: {},
        order_cancelled: true,
      });
    }

    const transactionId = createdTransaction?.id;
    if (!transactionId) {
      logger.error({
        message: 'RecordPayment side effects require a transaction id',
        orderId,
      });
      return NextResponse.json(
        { error: 'Failed to record payment' },
        { status: 500 }
      );
    }

    // Paid-order side effects (only when NOT cancelled).
    if (isFullyPaid) {
      try {
        await ensurePaidOrderInventoryConfirmed(supabase, merchantId, orderId);
      } catch (inventoryError) {
        if (manualPaymentResult.idempotency_replayed) {
          await fileInventoryConfirmationFailureReview({
            gatewayReference: reference ?? null,
            merchantId,
            metadata: {
              inventoryError:
                inventoryError instanceof Error
                  ? inventoryError.message
                  : inventoryError,
              source: 'record_payment_idempotent_replay_inventory_confirmation',
            },
            orderId,
            reason:
              'A replayed manual payment is paid, but serialized inventory confirmation still failed.',
            transactionId: createdTransaction?.id ?? null,
          });

          const payload =
            buildInventoryConfirmationFailurePayload(inventoryError);
          return NextResponse.json(payload, {
            status:
              payload.code === 'serialized_inventory_unavailable' ? 409 : 500,
          });
        }

        let cleanupFailed = false;
        let rollbackFailed = false;

        try {
          await rollbackOrderStatusAfterInventoryConfirmationFailure(
            supabase,
            merchantId,
            orderId,
            {
              payment_status:
                manualPaymentResult.previous_payment_status ??
                order.payment_status ??
                null,
              amount_paid:
                manualPaymentResult.previous_amount_paid ??
                order.amount_paid ??
                null,
              shipping_status:
                manualPaymentResult.previous_shipping_status ??
                order.shipping_status ??
                null,
            }
          );
        } catch (rollbackError) {
          cleanupFailed = true;
          rollbackFailed = true;
          logger.error({
            message:
              'RecordPayment failed to rollback order status after inventory confirmation failure',
            orderId,
            error: rollbackError,
          });
          await fileInventoryConfirmationFailureReview({
            gatewayReference: null,
            merchantId,
            metadata: {
              inventoryError:
                inventoryError instanceof Error
                  ? inventoryError.message
                  : inventoryError,
              rollbackError:
                rollbackError instanceof Error
                  ? rollbackError.message
                  : rollbackError,
              source: 'record_payment_inventory_confirmation_rollback',
            },
            orderId,
            reason:
              'Manual payment reached paid state, but serialized inventory confirmation and status rollback both failed.',
            transactionId: createdTransaction?.id ?? null,
          });
        }

        if (createdTransaction?.id && !rollbackFailed) {
          const { error: deleteTransactionError } = await supabase
            .from('transactions')
            .delete()
            .eq('id', createdTransaction.id)
            .eq('merchant_id', merchantId);

          if (deleteTransactionError) {
            cleanupFailed = true;
            logger.error({
              message:
                'RecordPayment failed to delete manual transaction after inventory confirmation failure',
              orderId,
              transactionId: createdTransaction.id,
              error: deleteTransactionError,
            });
            await fileInventoryConfirmationFailureReview({
              gatewayReference: null,
              merchantId,
              metadata: {
                deleteTransactionError,
                inventoryError:
                  inventoryError instanceof Error
                    ? inventoryError.message
                    : inventoryError,
                source:
                  'record_payment_inventory_confirmation_transaction_delete',
              },
              orderId,
              reason:
                'Manual payment inventory confirmation failed, but deleting the completed manual transaction also failed.',
              transactionId: createdTransaction.id,
            });
          }
        }

        logger.error({
          message: 'RecordPayment failed to confirm inventory',
          orderId,
          cleanupFailed,
          error: inventoryError,
        });

        if (cleanupFailed) {
          return NextResponse.json(
            {
              code: 'INVENTORY_CONFIRMATION_CLEANUP_FAILED',
              error: 'Inventory confirmation cleanup failed',
            },
            { status: 500 }
          );
        }

        const payload =
          buildInventoryConfirmationFailurePayload(inventoryError);
        return NextResponse.json(payload, {
          status:
            payload.code === 'serialized_inventory_unavailable' ? 409 : 500,
        });
      }

      logger.info({ message: 'RecordPayment order fully paid', orderId });

      // SEND CONFIRMATION EMAIL (If fully paid)
      try {
        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
        const merchantUrl = `https://${merchant.slug}.${rootDomain}`;

        const emailItems =
          order.order_items?.map((item: EmailOrderItem) => ({
            name: item.name || 'Product',
            quantity: item.quantity || 1,
            price: item.price || 0,
          })) || [];

        const emailData = {
          orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
          customerName: order.customer_name,
          items: emailItems,
          subtotal: Number(order.subtotal),
          shippingFee: Number(order.shipping_fee),
          total: Number(authoritativeOrderTotal),
          currency: order.currency || 'NGN',
          shippingAddress: {
            address: order.shipping_address?.address || '',
            city: order.shipping_address?.city || '',
            state: order.shipping_address?.state || '',
            phone: order.customer_phone || '',
          },
          merchantName: merchant.business_name,
          merchantUrl,
          merchantTin: merchant.tax_identification_number ?? undefined,
          merchantRcNumber: merchant.cac_rc_number ?? undefined,
        };

        const htmlContent = generateOrderConfirmationEmail(emailData);
        const textContent = generateOrderConfirmationText(emailData);

        const replyToEmail =
          merchant.support_email ||
          merchant.email ||
          `support@${merchant.slug}.${rootDomain}`;
        const senderName = merchant.email_sender_name
          ? `${merchant.email_sender_name} Orders`
          : `${merchant.business_name} Orders`;

        logger.info({
          message: 'RecordPayment sending confirmation email',
          orderId,
        });
        await runManualPaymentSideEffect({
          actor: `record-payment:${user.id}`,
          execute: async () => {
            const emailResult = await sendEmail({
              to: order.customer_email,
              toName: order.customer_name,
              subject: `Order Payment Confirmed - #${emailData.orderNumber}`,
              htmlContent,
              textContent,
              replyTo: replyToEmail,
              emailType: 'orders',
              fromName: senderName,
              clientReference: `manual-payment:${transactionId}:paid-email`,
              auditContext: {
                merchantId: merchant.id,
                orderId: order.id,
                customerId: order.customer_id,
                metadata: {
                  trigger: 'manual_payment_confirmation',
                },
              },
            });
            if (!emailResult.success) {
              throw new Error(emailResult.error || 'confirmation_email_failed');
            }
          },
          orderId,
          step: 'paid_email',
          supabase,
          transactionId,
        });
      } catch (emailErr) {
        logger.error({
          message: 'Error preparing email payload',
          error: emailErr,
        });
      }

      // --------------------------------------------------------
      // TRIGGER OFFLINE CONVERSION EVENT (Server-Side)
      // --------------------------------------------------------
      try {
        await runManualPaymentSideEffect({
          actor: `record-payment:${user.id}`,
          execute: () =>
            triggerPurchaseConversion(supabase, merchant.id, order),
          orderId,
          step: 'ad_tracking_conversion',
          supabase,
          transactionId,
        });
      } catch (conversionError) {
        logger.error({
          error: conversionError,
          message: 'RecordPayment conversion tracking failed',
          orderId,
        });
      }
    } else {
      logger.info({
        message: 'RecordPayment order partially paid',
        orderId,
      });

      // SEND PAYMENT RECEIPT EMAIL (Partial Payment)
      try {
        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';

        const emailItems =
          order.order_items?.map((item: EmailOrderItem) => ({
            name: item.name || 'Product',
            quantity: item.quantity || 1,
            price: item.price || 0,
          })) || [];

        const replyToEmail =
          merchant.support_email ||
          merchant.email ||
          `support@${merchant.slug}.${rootDomain}`;
        const senderName = merchant.email_sender_name
          ? `${merchant.email_sender_name} Accounts`
          : `${merchant.business_name} Accounts`;

        const receiptData = {
          orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
          customerName: order.customer_name,
          items: emailItems,
          totalAmount: Number(authoritativeOrderTotal),
          amountPaidNow: parsedAmount,
          totalPaidSoFar: Number(newPaid),
          balanceDue: Number(remainingBalance),
          currency: order.currency || 'NGN',
          merchantName: merchant.business_name,
          supportEmail: merchant.support_email,
          merchantTin: merchant.tax_identification_number ?? undefined,
          merchantRcNumber: merchant.cac_rc_number ?? undefined,
        };
        const htmlContent = generatePaymentReceiptEmail(receiptData);
        const textContent = generatePaymentReceiptText(receiptData);

        logger.info({
          message: 'RecordPayment sending receipt email',
          orderId,
        });
        await runManualPaymentSideEffect({
          actor: `record-payment:${user.id}`,
          execute: async () => {
            const emailResult = await sendEmail({
              to: order.customer_email,
              toName: order.customer_name,
              subject: `Payment Receipt - Order #${receiptData.orderNumber}`,
              htmlContent,
              textContent,
              replyTo: replyToEmail,
              emailType: 'orders',
              fromName: senderName,
              clientReference: `manual-payment:${transactionId}:partial-receipt`,
              auditContext: {
                merchantId: merchant.id,
                orderId: order.id,
                customerId: order.customer_id,
                metadata: {
                  trigger: 'manual_payment_receipt',
                },
              },
            });
            if (!emailResult.success) {
              throw new Error(
                emailResult.error || 'payment_receipt_email_failed'
              );
            }
          },
          orderId,
          step: 'partial_receipt',
          supabase,
          transactionId,
        });
      } catch (emailErr) {
        logger.error({
          message: 'Error preparing receipt email payload',
          error: emailErr,
        });
      }
    }

    logger.info({ message: 'RecordPayment success', orderId });
    return NextResponse.json({
      success: true,
      amount_paid: parsedAmount,
      idempotency_replayed:
        manualPaymentResult.idempotency_replayed || undefined,
      new_balance: remainingBalance,
      updated_status: updates,
    });
  } catch (error) {
    logger.error({
      message: 'RecordPayment internal error',
      error,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import type { PaymentStatus, ShippingStatus } from '@baci/shared';
import type { PostgrestError } from '@supabase/supabase-js';
import { after, type NextRequest, NextResponse } from 'next/server';
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

interface RecordPaymentTransactionRow {
  amount: number | string | null;
  error_code?: string | null;
  gateway: string | null;
  gateway_reference: string | null;
  status: string | null;
}

interface RecordManualPaymentResult {
  cancelled_at?: string | null;
  current_paid?: number | string | null;
  error_code?: string | null;
  new_paid?: number | string | null;
  order_total?: number | string | null;
  payment_status?: PaymentStatus | null;
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
    const { payment_method, reference, notes } = parsedBody.data;
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

    // Δ-36 (A3): widen the existing completed-only fetch to also cover
    // pending/processing rows so we can guard against shadowing a real
    // non-manual gateway payment (Paystack DVA, Korapay, Kuda, Credit
    // Direct, Juicyway) with a parallel manual transaction. The order was
    // tenant-scoped above, so read through an order-scoped RPC instead of
    // the denormalized transactions.merchant_id RLS predicate, which can
    // drift independently of the verified order row.
    const { data: relevantTxns, error: txError } = (await supabase.rpc(
      'get_record_payment_order_transactions',
      {
        p_merchant_id: merchantId,
        p_order_id: orderId,
      }
    )) as {
      data: RecordPaymentTransactionRow[] | null;
      error: PostgrestError | null;
    };

    if (txError) {
      logger.error({
        message: 'RecordPayment transactions fetch error',
        error: txError,
        orderId,
      });
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    const transactionReadError = relevantTxns?.find((t) => t.error_code);
    if (
      transactionReadError?.error_code ===
      'ORDER_PAYMENT_RECONCILIATION_REQUIRED'
    ) {
      logger.warn({
        message:
          'RecordPayment rejected: order transaction merchant drift requires reconciliation',
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

    if (transactionReadError?.error_code) {
      logger.error({
        message: 'RecordPayment transaction RPC returned unknown error code',
        errorCode: transactionReadError.error_code,
        merchantId: merchant.id,
        orderId,
      });
      return NextResponse.json(
        { error: 'Failed to fetch order transactions' },
        { status: 500 }
      );
    }

    // Δ-36 (A3): pending-gateway guard. Block manual record-payment
    // while a non-manual processor transaction (Paystack DVA, Korapay,
    // Kuda, Credit Direct, CredPal, Juicyway) is still pending or processing —
    // recording a parallel manual transaction would shadow the real
    // gateway payment (the failure mode that nearly bit us with Efosa).
    // Failed / cancelled gateway attempts do NOT block (they're not in
    // the SELECT's `IN ('completed','pending','processing')` window).
    const PENDING_PROCESSOR_GATEWAYS = new Set([
      'paystack',
      'korapay',
      'kuda',
      'credit_direct',
      'credpal',
      'klump',
      'juicyway',
    ]);
    const pendingProcessorTxn = relevantTxns?.find(
      (t) =>
        t.gateway !== null &&
        PENDING_PROCESSOR_GATEWAYS.has(t.gateway.toLowerCase()) &&
        (t.status === 'pending' || t.status === 'processing')
    );
    if (pendingProcessorTxn) {
      // Log the gateway name internally; client message stays generic
      // (no extra processor data leakage per the plan).
      logger.warn({
        message: 'RecordPayment rejected: pending processor transaction',
        orderId,
        merchantId: merchant.id,
        pendingGateway: pendingProcessorTxn.gateway,
        pendingStatus: pendingProcessorTxn.status,
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

    // Filter to completed-only for the duplicate-reference and paid-amount
    // calculations below (pre-A3 semantics).
    const transactions = relevantTxns?.filter((t) => t.status === 'completed');

    // Application-level duplicate guard (pre-insert). Only applies when the
    // caller provides a reference — reference-less payments skip this check.
    // NOTE: A concurrent request can still slip through this check. The DB-level
    // partial unique index on (order_id, gateway_reference) WHERE gateway_reference
    // IS NOT NULL (migration 20260504120000) is the authoritative safeguard.
    if (reference) {
      const existingTransaction = transactions?.find(
        (t) => t.gateway_reference === reference
      );
      if (existingTransaction) {
        logger.warn({
          message: 'RecordPayment duplicate reference rejected',
          orderId,
          merchantId: merchant.id,
          reference,
        });
        return NextResponse.json(
          { error: 'Duplicate payment reference', code: 'DUPLICATE_REFERENCE' },
          { status: 409 }
        );
      }
    }

    // 3. Calculate Totals
    const currentPaid =
      transactions?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
    const walletUsed = Number(order.wallet_amount_used) || 0;
    const totalPaidBefore = currentPaid + walletUsed;
    const orderTotal = Number(order.total) || 0;
    const remainingBeforePayment = orderTotal - totalPaidBefore;

    // Reject payments on fully-paid orders
    if (remainingBeforePayment <= 0) {
      logger.warn({
        message: 'RecordPayment rejected: order already fully paid',
        orderId,
        merchantId: merchant.id,
        orderTotal,
        totalPaidBefore,
      });
      return NextResponse.json(
        { error: 'Order is already fully paid' },
        { status: 409 }
      );
    }

    // Reject overpayments
    if (parsedAmount > remainingBeforePayment) {
      logger.warn({
        message: 'RecordPayment rejected: amount exceeds remaining balance',
        orderId,
        amount: parsedAmount,
        remainingBeforePayment,
      });
      return NextResponse.json(
        { error: 'Amount exceeds remaining balance' },
        { status: 409 }
      );
    }

    const estimatedNewPaid = totalPaidBefore + parsedAmount;
    const estimatedRemainingBalance = Math.max(
      0,
      orderTotal - estimatedNewPaid
    );

    logger.info({
      message: 'RecordPayment totals calculated',
      orderId,
      currentPaid,
      newPaid: estimatedNewPaid,
      orderTotal,
      remainingBalance: estimatedRemainingBalance,
    });

    // 4. Create Transaction
    // The pre-insert checks above provide fast feedback, but concurrent manual
    // requests can still read the same balance. The RPC is authoritative: it
    // locks the verified order row, recomputes completed payments, rejects stale
    // overpayments/duplicates, and inserts the manual transaction atomically.
    const paymentDescription =
      notes ||
      (payment_method
        ? `Manual payment (${payment_method})`
        : 'Manual payment');
    const { data: manualPaymentResult, error: transactionError } =
      (await supabase.rpc('record_manual_order_payment', {
        p_amount: parsedAmount,
        p_currency: order.currency || 'NGN',
        p_description: paymentDescription,
        p_gateway_reference: reference ?? null,
        p_merchant_id: merchant.id,
        p_metadata: {
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
    const newPaid = Number(manualPaymentResult.new_paid ?? estimatedNewPaid);
    const remainingBalance = Number(
      manualPaymentResult.remaining_balance ?? estimatedRemainingBalance
    );
    const lockedOrderTotal = Number(
      manualPaymentResult.order_total ?? newPaid + remainingBalance
    );
    const authoritativeOrderTotal = Number.isFinite(lockedOrderTotal)
      ? lockedOrderTotal
      : Number(orderTotal);

    // 5. Consume the authoritative order status written by the RPC.
    // Keeping status mutation inside the same DB transaction as the manual
    // payment insert prevents a slower partial-payment request from overwriting
    // a faster concurrent full-payment request after both RPCs return.
    const rpcPaymentStatus = manualPaymentResult.payment_status ?? null;
    const rpcShippingStatus = manualPaymentResult.shipping_status ?? null;

    if (!rpcPaymentStatus || !rpcShippingStatus) {
      logger.error({
        message:
          'CRITICAL: RecordPayment RPC inserted a transaction without returning updated order status',
        manualPaymentResult,
        orderId,
        inconsistentState: true,
      });
      return NextResponse.json({
        success: true,
        amount_paid: parsedAmount,
        new_balance: remainingBalance,
        updated_status: {},
        status_update_failed: true,
      });
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
        new_balance: remainingBalance,
        updated_status: {},
        order_cancelled: true,
      });
    }

    // Paid-order side effects (only when NOT cancelled).
    if (isFullyPaid) {
      try {
        await ensurePaidOrderInventoryConfirmed(supabase, merchantId, orderId);
      } catch (inventoryError) {
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

        // Fire and forget
        logger.info({
          message: 'RecordPayment sending confirmation email',
          orderId,
        });
        sendEmail({
          to: order.customer_email,
          toName: order.customer_name,
          subject: `Order Payment Confirmed - #${emailData.orderNumber}`,
          htmlContent,
          textContent,
          replyTo: replyToEmail,
          emailType: 'orders',
          fromName: senderName,
          auditContext: {
            merchantId: merchant.id,
            orderId: order.id,
            customerId: order.customer_id,
            metadata: {
              trigger: 'manual_payment_confirmation',
            },
          },
        }).catch((err) =>
          logger.error({
            message: 'Failed to send confirmation email',
            error: err,
          })
        );
      } catch (emailErr) {
        logger.error({
          message: 'Error preparing email payload',
          error: emailErr,
        });
      }

      // --------------------------------------------------------
      // TRIGGER OFFLINE CONVERSION EVENT (Server-Side)
      // --------------------------------------------------------
      // Schedule background task using Next.js `after()` for proper lifecycle management
      // This runs AFTER the response is sent, ensuring the user gets a fast response
      after(async () => {
        try {
          await triggerPurchaseConversion(supabase, merchant.id, order);
        } catch {
          // Errors are already logged inside triggerPurchaseConversion
          // This catch prevents unhandled rejections in the background task
        }
      });
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
        sendEmail({
          to: order.customer_email,
          toName: order.customer_name,
          subject: `Payment Receipt - Order #${receiptData.orderNumber}`,
          htmlContent,
          textContent,
          replyTo: replyToEmail,
          emailType: 'orders',
          fromName: senderName,
          auditContext: {
            merchantId: merchant.id,
            orderId: order.id,
            customerId: order.customer_id,
            metadata: {
              trigger: 'manual_payment_receipt',
            },
          },
        }).catch((err) =>
          logger.error({ message: 'Failed to send receipt email', error: err })
        );
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

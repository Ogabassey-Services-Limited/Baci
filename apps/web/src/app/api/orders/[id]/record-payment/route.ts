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
import { triggerPurchaseConversion } from '@/lib/trigger-purchase-conversion';
import { sendEmail } from '@/lib/zeptomail';
import { recordPaymentBodySchema } from '@/schemas/record-payment';

/** Order item interface for email templates (2026 best practice) */
interface EmailOrderItem {
  name: string;
  quantity: number;
  price: number;
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

    // 2. Parse and validate request body (before any DB calls)
    let body: unknown;

    try {
      body = await request.json();
    } catch (error) {
      logger.warn({
        message: 'RecordPayment invalid JSON body',
        error,
        orderId: id,
      });
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsedBody = recordPaymentBodySchema.safeParse(body);
    if (!parsedBody.success) {
      logger.warn({
        message: 'RecordPayment invalid request body',
        orderId: id,
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
      orderId: id,
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
        orderId: id,
      });
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Fetch full Merchant details for email
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(
        'id, business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
      )
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      logger.error({
        message: 'RecordPayment merchant details error',
        error: merchantError,
        merchantId,
        orderId: id,
      });
      return NextResponse.json(
        { error: 'Merchant details not found' },
        { status: 404 }
      );
    }

    // 2. Fetch Order & Items & Existing Transactions
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(ORDER_WITH_ITEMS_QUERY)
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .single();

    if (orderError || !order) {
      logger.error({
        message: 'RecordPayment order not found',
        error: orderError,
        orderId: id,
        merchantId: merchant.id,
      });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('amount, gateway_reference')
      .eq('order_id', id)
      .eq('status', 'completed');

    if (txError) {
      logger.error({
        message: 'RecordPayment transactions fetch error',
        error: txError,
        orderId: id,
      });
      return NextResponse.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // Application-level duplicate guard (pre-insert).
    // NOTE: A concurrent request can still slip through this check. The DB-level
    // unique constraint on (order_id, gateway_reference) is the true safeguard.
    const existingTransaction = transactions?.find(
      (t) => t.gateway_reference === reference
    );
    if (existingTransaction) {
      logger.warn({
        message: 'RecordPayment duplicate reference rejected',
        orderId: id,
        merchantId: merchant.id,
        reference,
      });
      return NextResponse.json(
        { error: 'Duplicate payment reference', code: 'DUPLICATE_REFERENCE' },
        { status: 409 }
      );
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
        orderId: id,
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
        orderId: id,
        amount: parsedAmount,
        remainingBeforePayment,
      });
      return NextResponse.json(
        { error: 'Amount exceeds remaining balance' },
        { status: 409 }
      );
    }

    const newPaid = totalPaidBefore + parsedAmount;
    const remainingBalance = Math.max(0, orderTotal - newPaid);

    logger.info({
      message: 'RecordPayment totals calculated',
      orderId: id,
      currentPaid,
      newPaid,
      orderTotal,
      remainingBalance,
    });

    // 4. Create Transaction
    // The pre-insert duplicate guard above catches known duplicates.
    // A DB-level unique constraint on (order_id, gateway_reference) provides
    // the authoritative safeguard against concurrent duplicate inserts.
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        merchant_id: merchant.id,
        order_id: id,
        transaction_type: 'payment',
        amount: parsedAmount,
        currency: order.currency || 'NGN',
        status: 'completed', // Valid values: pending, processing, completed, failed, cancelled
        gateway: 'manual',
        gateway_reference: reference,
        description:
          notes ||
          (payment_method
            ? `Manual payment (${payment_method})`
            : 'Manual payment'),
        metadata: {
          payment_method: payment_method || 'manual',
          recorded_by: user.email,
        },
      });

    if (transactionError) {
      // Detect duplicate reference conflict (unique constraint violation = code 23505)
      const isDuplicate =
        transactionError.code === '23505' ||
        transactionError.message?.toLowerCase().includes('duplicate') ||
        transactionError.message?.toLowerCase().includes('unique');

      if (isDuplicate) {
        logger.warn({
          message: 'RecordPayment duplicate reference rejected at DB level',
          orderId: id,
          merchantId: merchant.id,
          reference,
        });
        return NextResponse.json(
          { error: 'Duplicate payment reference', code: 'DUPLICATE_REFERENCE' },
          { status: 409 }
        );
      }

      logger.error({
        message: 'RecordPayment transaction insert error',
        error: transactionError,
        orderId: id,
      });
      return NextResponse.json(
        { error: 'Failed to record payment' },
        { status: 500 }
      );
    }

    // 5. Update Order Status
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic update object
    const updates: any = {};

    // Payment Status Logic
    if (newPaid >= orderTotal) {
      logger.info({ message: 'RecordPayment order fully paid', orderId: id });
      updates.payment_status = 'paid';
      // Auto-advance shipping if pending
      if (order.shipping_status === 'pending') {
        updates.shipping_status = 'processing';
      }

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
          total: Number(orderTotal),
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
          orderId: id,
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
        orderId: id,
      });
      updates.payment_status = 'partially_paid';
      // Auto-advance shipping status for partial payments too (indicates activity)
      if (order.shipping_status === 'pending') {
        updates.shipping_status = 'processing';
      }

      // SEND PAYMENT RECEIPT EMAIL (Partial Payment)
      try {
        const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
        const merchantUrl = `https://${merchant.slug}.${rootDomain}`;

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
          totalAmount: Number(orderTotal),
          amountPaidNow: parsedAmount,
          totalPaidSoFar: Number(newPaid),
          balanceDue: Number(remainingBalance),
          merchantName: merchant.business_name,
          merchantUrl,
          supportEmail: merchant.support_email,
          merchantTin: merchant.tax_identification_number ?? undefined,
          merchantRcNumber: merchant.cac_rc_number ?? undefined,
        };
        const htmlContent = generatePaymentReceiptEmail(receiptData);
        const textContent = generatePaymentReceiptText(receiptData);

        logger.info({
          message: 'RecordPayment sending receipt email',
          orderId: id,
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

    // Apply updates if needed
    if (Object.keys(updates).length > 0) {
      logger.info({
        message: 'RecordPayment applying status updates',
        updates,
        orderId: id,
      });
      const { error: updateError } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id);

      if (updateError) {
        logger.error({
          message:
            'CRITICAL: RecordPayment failed to update order status after transaction created',
          error: updateError,
          orderId: id,
          inconsistentState: true,
        });
        // Note: Transaction was already created, so we don't fail the request entirely,
        // but it's an inconsistent state. Ideally would use a stored procedure/transaction.
      }
    }

    logger.info({ message: 'RecordPayment success', orderId: id });
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

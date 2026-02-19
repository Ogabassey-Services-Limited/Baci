import { after, type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
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
import { purchaseInsuranceForPaidOrder } from '@/services/insurance';

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
  const { id } = await params;
  try {
    logger.info({ message: 'RecordPayment starting', orderId: id });

    const body = await request.json();
    const { amount, payment_method, reference, notes } = body;
    logger.info({
      message: 'RecordPayment body parsed',
      amount,
      payment_method,
      orderId: id,
    });

    // Input validation: Ensure amount is a positive number.
    // Note: This is NOT a security bypass - it's input validation that runs BEFORE
    // authentication. The actual security is enforced below via:
    // 1. authenticateApiRequest() - verifies the user is authenticated
    // 2. getMerchantIdForApiUser() - gets the merchant for this user
    // 3. Order query with .eq('merchant_id', merchant.id) - ensures order ownership
    // lgtm[js/user-controlled-bypass] codeql[js/user-controlled-bypass-of-security-check]
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Authenticate request (supports mobile Bearer token + web cookies)
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

    // Get merchant ID (supports both owners and staff members)
    const merchantId = await getMerchantIdForApiUser(auth.supabase);
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

    const supabase = auth.supabase;

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

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount')
      .eq('order_id', id)
      .eq('status', 'completed');

    // 3. Calculate Totals
    const currentPaid =
      transactions?.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
    const walletUsed = Number(order.wallet_amount_used) || 0;
    const totalPaidBefore = currentPaid + walletUsed;
    const newPaid = totalPaidBefore + Number(amount);
    const orderTotal = Number(order.total) || 0;
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
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        merchant_id: merchant.id,
        order_id: id,
        transaction_type: 'payment',
        amount: amount,
        currency: order.currency || 'NGN',
        status: 'completed', // Valid values: pending, processing, completed, failed, cancelled
        gateway: 'manual',
        gateway_reference: reference || `MAN-${Date.now()}`,
        description: notes || `Manual payment (${payment_method})`,
        metadata: {
          payment_method: payment_method || 'manual',
          recorded_by: user.email,
        },
      });

    if (transactionError) {
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

      // Auto-purchase MyCover shipping insurance for orders with assurance
      after(async () => {
        try {
          await purchaseInsuranceForPaidOrder(supabase, id, merchant.id);
        } catch {
          // Errors logged inside purchaseInsuranceForPaidOrder
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
          amountPaidNow: Number(amount),
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
      amount_paid: amount,
      new_balance: remainingBalance,
      updated_status: updates,
    });
    // biome-ignore lint/suspicious/noExplicitAny: Catch error type
  } catch (error: any) {
    logger.error({
      message: 'RecordPayment internal error',
      error,
      orderId: id,
    });
    return NextResponse.json(
      { error: error.message || 'Internal Error' },
      { status: 500 }
    );
  }
}

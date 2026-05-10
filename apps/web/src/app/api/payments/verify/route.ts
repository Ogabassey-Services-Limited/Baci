import { after, type NextRequest, NextResponse } from 'next/server';
import {
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
} from '@/lib/email-templates';
import { notifyNewOrder, notifyPaymentReceived } from '@/lib/expo-push';
import { verifyPayment as verifyKorapayPayment } from '@/lib/korapay';
import { logger } from '@/lib/logger';
import { verifyTransaction as verifyPaystackPayment } from '@/lib/paystack';
import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/lib/zeptomail';
import { referenceSchema } from '@/schemas/payments';

type GatewayVerificationResult =
  | {
      success: true;
      status: string;
      gatewayResponse: Record<string, unknown>;
    }
  | {
      success: false;
      error: string;
      code?: string;
    };

type ShippingAddress = {
  address?: string;
  city?: string;
  state?: string;
};

function getVerifiedAmount(
  gateway: string,
  gatewayResponse: Record<string, unknown>
): { amount: number; currency?: string } | null {
  const rawAmount = gatewayResponse.amount;
  if (
    typeof rawAmount !== 'number' ||
    !Number.isFinite(rawAmount) ||
    rawAmount <= 0
  ) {
    return null;
  }

  const currency =
    typeof gatewayResponse.currency === 'string'
      ? gatewayResponse.currency
      : undefined;
  // Paystack returns amounts in kobo (smallest unit), divide by 100
  const amount = gateway === 'paystack' ? rawAmount / 100 : rawAmount;

  return { amount, currency };
}

async function verifyGatewayPayment(
  gateway: string,
  reference: string
): Promise<GatewayVerificationResult> {
  if (gateway === 'paystack') {
    const result = await verifyPaystackPayment(reference);
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      status: result.data.status,
      gatewayResponse: result.data as unknown as Record<string, unknown>,
    };
  }

  if (gateway === 'korapay') {
    const result = await verifyKorapayPayment(reference);
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      status: result.data.status,
      gatewayResponse: result.data as unknown as Record<string, unknown>,
    };
  }

  return {
    success: false,
    error: `Unsupported gateway: ${gateway}`,
    code: 'UNSUPPORTED_GATEWAY',
  };
}

export async function GET(request: NextRequest) {
  const reference = new URL(request.url).searchParams.get('reference') ?? '';
  const parsedReference = referenceSchema.safeParse(reference);

  if (!parsedReference.success) {
    return NextResponse.json({ error: 'Invalid reference' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: transaction, error: transactionError } = await supabase
    .from('transactions')
    .select(
      'id, order_id, merchant_id, amount, currency, status, gateway, gateway_reference, platform_fee'
    )
    .eq('gateway_reference', parsedReference.data)
    .maybeSingle();

  if (transactionError || !transaction) {
    logger.warn({
      message: 'Payment verification transaction lookup failed',
      reference: parsedReference.data,
      error: transactionError,
    });
    return NextResponse.json(
      { error: 'Transaction not found' },
      { status: 404 }
    );
  }

  const { data: existingOrder } = transaction.order_id
    ? await supabase
        .from('orders')
        .select('id, order_number, payment_status, shipping_status')
        .eq('id', transaction.order_id)
        .maybeSingle()
    : { data: null };

  // If the transaction is already completed AND the order is fully reconciled,
  // return early. If the webhook marked the transaction completed but crashed
  // before updating the order, we must fall through to reconcile the order.
  if (
    transaction.status === 'completed' &&
    existingOrder?.payment_status === 'paid'
  ) {
    return NextResponse.json({
      success: true,
      status: 'success',
      orderNumber:
        existingOrder?.order_number ||
        transaction.gateway_reference.slice(0, 8).toUpperCase(),
    });
  }

  const verification = await verifyGatewayPayment(
    transaction.gateway,
    parsedReference.data
  );

  if (!verification.success) {
    logger.warn({
      message: 'Payment verification failed',
      reference: parsedReference.data,
      gateway: transaction.gateway,
      error: verification.error,
      code: verification.code,
    });
    return NextResponse.json(
      {
        success: false,
        status: 'pending',
        error: verification.error,
        orderNumber:
          existingOrder?.order_number ||
          transaction.gateway_reference.slice(0, 8).toUpperCase(),
      },
      { status: 400 }
    );
  }

  if (verification.status !== 'success') {
    return NextResponse.json({
      success: false,
      status: verification.status,
      orderNumber:
        existingOrder?.order_number ||
        transaction.gateway_reference.slice(0, 8).toUpperCase(),
    });
  }

  // Verify the gateway-confirmed amount matches our stored transaction amount
  // (mirrors the webhook's amount/currency checks to prevent partial-pay exploits)
  const verifiedAmount = getVerifiedAmount(
    transaction.gateway,
    verification.gatewayResponse
  );

  if (verifiedAmount) {
    const transactionAmount = Number(transaction.amount) || 0;
    if (Math.abs(verifiedAmount.amount - transactionAmount) > 0.01) {
      logger.error({
        message: 'Payment verify route amount mismatch',
        reference: parsedReference.data,
        gateway: transaction.gateway,
        expected: transactionAmount,
        received: verifiedAmount.amount,
      });
      return NextResponse.json(
        { error: 'Payment amount mismatch' },
        { status: 400 }
      );
    }

    const expectedCurrency =
      typeof transaction.currency === 'string' ? transaction.currency : null;
    if (
      expectedCurrency &&
      verifiedAmount.currency &&
      expectedCurrency.toUpperCase() !== verifiedAmount.currency.toUpperCase()
    ) {
      logger.error({
        message: 'Payment verify route currency mismatch',
        reference: parsedReference.data,
        gateway: transaction.gateway,
        expected: expectedCurrency,
        received: verifiedAmount.currency,
      });
      return NextResponse.json(
        { error: 'Payment currency mismatch' },
        { status: 400 }
      );
    }
  }

  const { data: updatedTxn, error: updateTxnError } = await supabase
    .from('transactions')
    .update({
      status: 'completed',
      gateway_response: verification.gatewayResponse,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transaction.id)
    .neq('status', 'completed')
    .select('id')
    .maybeSingle();

  if (updateTxnError) {
    logger.error({
      message: 'Payment verify route failed to update transaction',
      reference: parsedReference.data,
      error: updateTxnError,
    });
    return NextResponse.json(
      { error: 'Failed to finalize transaction' },
      { status: 500 }
    );
  }

  // If updatedTxn is null, another request already claimed this transaction.
  // Only proceed with order reconciliation if we won the race (or if the
  // transaction was already completed but the order still needs reconciliation,
  // which is the fall-through case from the short-circuit check above).
  const shouldReconcileOrder =
    updatedTxn !== null || transaction.status === 'completed';

  if (!shouldReconcileOrder) {
    // Another request won the race — return success without double-updating the order
    return NextResponse.json({
      success: true,
      status: 'success',
      orderNumber:
        existingOrder?.order_number ||
        transaction.gateway_reference.slice(0, 8).toUpperCase(),
    });
  }

  const { data: order, error: orderError } = transaction.order_id
    ? await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          // Only advance to 'processing' from 'pending' — avoid regressing orders
          // that the merchant already moved to 'shipped' or 'delivered'.
          ...((!existingOrder ||
            existingOrder.shipping_status === 'pending') && {
            shipping_status: 'processing',
          }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.order_id)
        .select(
          'id, order_number, customer_id, total, subtotal, shipping_fee, customer_name, customer_email, customer_phone, shipping_address, currency, order_items(name, quantity, price, variant_name)'
        )
        .single()
    : { data: null, error: null };

  if (orderError || !order) {
    logger.error({
      message: 'Payment verify route failed to update order',
      reference: parsedReference.data,
      orderId: transaction.order_id,
      error: orderError,
    });
    return NextResponse.json(
      { error: 'Failed to finalize order' },
      { status: 500 }
    );
  }

  if (updatedTxn) {
    after(async () => {
      try {
        await notifyNewOrder(
          transaction.merchant_id,
          order.id,
          order.order_number || order.id.slice(0, 8).toUpperCase(),
          order.customer_name || 'Customer',
          Number(order.total) || 0,
          order.currency || 'NGN'
        );
      } catch (error) {
        logger.warn({
          message: 'Payment verify route failed to send new order push',
          error,
          orderId: order.id,
        });
      }

      try {
        await notifyPaymentReceived(
          transaction.merchant_id,
          Number(order.total) || 0,
          order.currency || 'NGN',
          order.order_number || order.id.slice(0, 8).toUpperCase(),
          order.id
        );
      } catch (error) {
        logger.warn({
          message: 'Payment verify route failed to send payment push',
          error,
          orderId: order.id,
        });
      }

      try {
        const { data: merchant } = await supabase
          .from('merchants')
          .select(
            'business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
          )
          .eq('id', transaction.merchant_id)
          .single();

        if (merchant && order.customer_email) {
          const rootDomain =
            process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
          const merchantUrl = `https://${merchant.slug}.${rootDomain}`;
          const shippingAddress = (order.shipping_address ||
            {}) as ShippingAddress;

          const emailItems = (order.order_items || []).map(
            (item: {
              name?: string;
              quantity?: number;
              price?: number;
              variant_name?: string | null;
            }) => ({
              name: item.variant_name
                ? `${item.name || 'Product'} (${item.variant_name})`
                : (item.name ?? 'Product'),
              quantity: item.quantity || 1,
              price: item.price || 0,
            })
          );

          const htmlContent = generateOrderConfirmationEmail({
            orderNumber:
              order.order_number || order.id.slice(0, 8).toUpperCase(),
            customerName: order.customer_name,
            items: emailItems,
            subtotal: Number(order.subtotal || 0),
            shippingFee: Number(order.shipping_fee || 0),
            total: Number(order.total || 0),
            shippingAddress: {
              address: shippingAddress.address || '',
              city: shippingAddress.city || '',
              state: shippingAddress.state || '',
              phone: order.customer_phone || '',
            },
            merchantName: merchant.business_name,
            merchantUrl,
            merchantTin: merchant.tax_identification_number ?? undefined,
            merchantRcNumber: merchant.cac_rc_number ?? undefined,
          });

          const textContent = generateOrderConfirmationText({
            orderNumber:
              order.order_number || order.id.slice(0, 8).toUpperCase(),
            customerName: order.customer_name,
            items: emailItems,
            subtotal: Number(order.subtotal || 0),
            shippingFee: Number(order.shipping_fee || 0),
            total: Number(order.total || 0),
            shippingAddress: {
              address: shippingAddress.address || '',
              city: shippingAddress.city || '',
              state: shippingAddress.state || '',
              phone: order.customer_phone || '',
            },
            merchantName: merchant.business_name,
            merchantUrl,
            merchantTin: merchant.tax_identification_number ?? undefined,
            merchantRcNumber: merchant.cac_rc_number ?? undefined,
          });

          const replyToEmail =
            merchant.support_email ||
            merchant.email ||
            `support@${merchant.slug}.${rootDomain}`;
          const senderName = merchant.email_sender_name
            ? `${merchant.email_sender_name} Orders`
            : merchant.business_name
              ? `${merchant.business_name} Orders`
              : undefined;

          await sendEmail({
            to: order.customer_email,
            toName: order.customer_name,
            subject: `Order Confirmation - #${order.order_number || order.id.slice(0, 8).toUpperCase()}`,
            htmlContent,
            textContent,
            replyTo: replyToEmail,
            emailType: 'orders',
            fromName: senderName,
            auditContext: {
              merchantId: transaction.merchant_id,
              orderId: order.id,
              customerId: order.customer_id,
              metadata: {
                trigger: 'payment_verify_confirmation',
                gateway: transaction.gateway,
              },
            },
          });
        }
      } catch (error) {
        logger.warn({
          message:
            'Payment verify route failed to send order confirmation email',
          error,
          orderId: order.id,
        });
      }

      try {
        await supabase.rpc('record_merchant_settlement', {
          p_merchant_id: transaction.merchant_id,
          p_source_type: 'order',
          p_source_id: order.id,
          p_gateway: transaction.gateway,
          p_gateway_reference: parsedReference.data,
          p_gross_amount: Number(transaction.amount) || 0,
          p_gateway_fee: 0,
          p_platform_fee: Number(transaction.platform_fee) || 0,
          p_description: `Order payment via ${transaction.gateway}`,
        });
      } catch (error) {
        logger.warn({
          message: 'Payment verify route failed to record settlement',
          error,
          orderId: order.id,
        });
      }
    });
  }

  return NextResponse.json({
    success: true,
    status: 'success',
    orderNumber:
      order.order_number ||
      transaction.gateway_reference.slice(0, 8).toUpperCase(),
  });
}

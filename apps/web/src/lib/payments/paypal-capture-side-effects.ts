import 'server-only';

import {
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
} from '@/lib/email-templates';
import { notifyNewOrder, notifyPaymentReceived } from '@/lib/expo-push';
import { logger } from '@/lib/logger';
import { recordByokFeeAccrual } from '@/lib/payments/record-byok-fee-accrual';
import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/lib/zeptomail';

/**
 * Post-capture side effects for the PayPal BYOK lane (Wave 2, see
 * docs/payments/byok-payment-providers-plan.md Phase 2 items 6). Extracted
 * from the prototype's inline `after()` block so the route stays under the
 * 300-line cap and each concern is independently testable.
 *
 * Settlement uses the NEW direct-to-merchant fork
 * (`record_merchant_settlement_v2` with `p_settlement_type =
 * 'direct_to_merchant'`, migration 20260708140644) instead of the legacy
 * `record_merchant_settlement`: money already reached the merchant's own PayPal
 * account, so this writes an informational ledger row only — no wallet credit,
 * no upcoming balance, and no "funds settled" email. The platform fee is 0.
 *
 * Every effect is best-effort: a captured payment is already recorded, so a
 * failed email/push/settlement is logged, never thrown.
 */

interface PaypalCaptureOrderItem {
  name?: string | null;
  quantity?: number | null;
  price?: number | null;
  variant_name?: string | null;
}

interface PaypalCaptureShippingAddress {
  address?: string;
  city?: string;
  state?: string;
}

export interface PaypalCaptureOrder {
  id: string;
  order_number?: string | null;
  customer_id?: string | null;
  total?: number | null;
  subtotal?: number | null;
  shipping_fee?: number | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  shipping_address?: PaypalCaptureShippingAddress | null;
  currency?: string | null;
  order_items?: PaypalCaptureOrderItem[] | null;
}

function orderNumberOf(order: PaypalCaptureOrder): string {
  return order.order_number || order.id.slice(0, 8).toUpperCase();
}

async function notify(
  merchantId: string,
  order: PaypalCaptureOrder
): Promise<void> {
  try {
    const total = Number(order.total) || 0;
    const currency = order.currency || 'USD';
    const orderNumber = orderNumberOf(order);
    await notifyNewOrder(
      merchantId,
      order.id,
      orderNumber,
      order.customer_name || 'Customer',
      total,
      currency
    );
    await notifyPaymentReceived(
      merchantId,
      total,
      currency,
      orderNumber,
      order.id
    );
  } catch (pushError) {
    logger.warn({
      message: 'PayPal capture: push notifications failed',
      error: pushError,
      orderId: order.id,
    });
  }
}

async function emailConfirmation(
  merchantId: string,
  order: PaypalCaptureOrder,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  try {
    const { data: merchant } = await supabase
      .from('merchants')
      .select(
        'business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
      )
      .eq('id', merchantId)
      .single();

    if (!merchant || !order.customer_email) {
      return;
    }

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const merchantUrl = `https://${merchant.slug}.${rootDomain}`;
    const shippingAddress = order.shipping_address || {};
    const orderNumber = orderNumberOf(order);

    const emailItems = (order.order_items || []).map((item) => ({
      name: item.variant_name
        ? `${item.name || 'Product'} (${item.variant_name})`
        : (item.name ?? 'Product'),
      quantity: item.quantity || 1,
      price: item.price || 0,
    }));

    const addressPayload = {
      address: shippingAddress.address || '',
      city: shippingAddress.city || '',
      state: shippingAddress.state || '',
      phone: order.customer_phone || '',
    };
    const templatePayload = {
      orderNumber,
      customerName: order.customer_name ?? '',
      items: emailItems,
      subtotal: Number(order.subtotal || 0),
      shippingFee: Number(order.shipping_fee || 0),
      total: Number(order.total || 0),
      shippingAddress: addressPayload,
      merchantName: merchant.business_name,
      merchantUrl,
      merchantTin: merchant.tax_identification_number ?? undefined,
      merchantRcNumber: merchant.cac_rc_number ?? undefined,
    };

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
      toName: order.customer_name ?? undefined,
      subject: `Order Confirmation - #${orderNumber}`,
      htmlContent: generateOrderConfirmationEmail(templatePayload),
      textContent: generateOrderConfirmationText(templatePayload),
      replyTo: replyToEmail,
      emailType: 'orders',
      fromName: senderName,
      auditContext: {
        merchantId,
        orderId: order.id,
        customerId: order.customer_id ?? undefined,
        metadata: { trigger: 'paypal_capture_confirmation', gateway: 'paypal' },
      },
    });
  } catch (emailError) {
    logger.warn({
      message: 'PayPal capture: email confirmation failed',
      error: emailError,
      orderId: order.id,
    });
  }
}

async function recordDirectSettlement(
  merchantId: string,
  order: PaypalCaptureOrder,
  paypalOrderId: string,
  grossAmount: number,
  supabase: ReturnType<typeof createServiceClient>
): Promise<void> {
  try {
    const { error: settlementError } = await supabase.rpc(
      'record_merchant_settlement_v2',
      {
        p_merchant_id: merchantId,
        p_source_type: 'order',
        p_source_id: order.id,
        p_gateway: 'paypal',
        p_gateway_reference: paypalOrderId,
        p_gross_amount: grossAmount,
        p_gateway_fee: 0,
        p_platform_fee: 0,
        p_description: 'Order paid directly to merchant via PayPal',
        p_metadata: { paypal_order_id: paypalOrderId },
        p_settlement_type: 'direct_to_merchant',
      }
    );

    if (settlementError) {
      logger.warn({
        message: 'PayPal capture: record_merchant_settlement_v2 returned error',
        error: settlementError,
        merchantId,
        orderId: order.id,
      });
    }
  } catch (settleError) {
    logger.warn({
      message: 'PayPal capture: failed to record direct settlement',
      error: settleError,
      orderId: order.id,
    });
  }
}

export async function runPaypalCaptureSideEffects({
  merchantId,
  order,
  paypalOrderId,
  grossAmount,
}: {
  merchantId: string;
  order: PaypalCaptureOrder;
  paypalOrderId: string;
  grossAmount: number;
}): Promise<void> {
  const supabase = createServiceClient();
  await notify(merchantId, order);
  await emailConfirmation(merchantId, order, supabase);
  await recordDirectSettlement(
    merchantId,
    order,
    paypalOrderId,
    grossAmount,
    supabase
  );
  // Fee-accrual ledger row (fee waived) is written only after a successful
  // capture, alongside the settlement — never at order initialization, so an
  // abandoned/cancelled PayPal approval leaves no orphan accrual (F8). Records
  // the full order-currency amount (matches what create-order previously
  // passed), and is best-effort: it logs, never throws.
  await recordByokFeeAccrual({
    merchantId,
    orderId: order.id,
    transactionReference: paypalOrderId,
    provider: 'paypal',
    currency: order.currency ?? 'USD',
    orderAmount: Number(order.total) || grossAmount,
  });
}

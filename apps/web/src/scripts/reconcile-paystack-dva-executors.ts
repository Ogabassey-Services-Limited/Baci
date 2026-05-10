// `applyPaidOrderSideEffects` step executors for the manual A2
// reconcile script. Extracted to keep the entry-point script under the
// 300-line per-file cap.
//
// These executors intentionally mirror the production webhook
// (apps/web/src/app/api/payments/webhook/route.ts:1677-1834) so a
// manual reconcile produces the same external side effects as a normal
// Paystack webhook: confirmation email, ad-tracking conversion,
// settlement RPC. firs_invoice + loyalty_points are stubs until B3.5
// wires the real integrations; the Δ-31 consistency gate inside the
// outbox helper short-circuits these for orders with inconsistent
// totals (Efosa) so the stub never runs in that case.

import {
  generateOrderConfirmationEmail,
  generateOrderConfirmationText,
} from '@/lib/email-templates';
import { calculatePlatformFee } from '@/lib/paystack';
import type {
  PaidOrder,
  PaidTransaction,
  SideEffectStep,
  StepExecutor,
} from '@/lib/payments/apply-paid-order-side-effects';
import { extractVerifiedGatewayFeeNgn } from '@/lib/payments/verified-gateway-fee';
import type { createServiceClient } from '@/lib/supabase/service';
import { triggerPurchaseConversion } from '@/lib/trigger-purchase-conversion';
import { sendEmail } from '@/lib/zeptomail';

export type MerchantDetails = {
  business_name: string | null;
  slug: string | null;
  support_email: string | null;
  email_sender_name: string | null;
  email: string | null;
  tax_identification_number: string | null;
  cac_rc_number: string | null;
};

type ServiceRoleClient = ReturnType<typeof createServiceClient>;

export type BuildScriptExecutorsArgs = {
  supabase: ServiceRoleClient;
  richOrder: Record<string, unknown>;
  order: PaidOrder;
  transaction: PaidTransaction;
  paystackReference: string;
  merchantDetails: MerchantDetails | null;
  merchantFetchError: unknown;
  rawPlatformFee: unknown;
  actor: string;
};

export function buildScriptExecutors(
  args: BuildScriptExecutorsArgs
): Partial<Record<SideEffectStep, StepExecutor>> {
  const {
    supabase,
    richOrder,
    order,
    transaction,
    paystackReference,
    merchantDetails,
    merchantFetchError,
    rawPlatformFee,
    actor,
  } = args;

  const paidEmailExecutor: StepExecutor = async () => {
    if (merchantFetchError) {
      throw new Error(
        `merchant_fetch_error: ${(merchantFetchError as { message?: string })?.message ?? 'unknown'}`
      );
    }
    if (!(merchantDetails && richOrder.customer_email)) {
      return { skipped: 'missing_merchant_or_customer_email' };
    }

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const merchantUrl = `https://${merchantDetails.slug}.${rootDomain}`;
    const orderItems = Array.isArray(richOrder.order_items)
      ? (richOrder.order_items as Array<Record<string, unknown>>)
      : [];
    const emailItems = orderItems.map((item) => ({
      name:
        typeof item.variant_name === 'string' &&
        item.variant_name.trim().length > 0
          ? `${(item.name as string) || 'Product'} (${item.variant_name})`
          : (item.name as string) || 'Product',
      quantity: (item.quantity as number) || 1,
      price: (item.price as number) || 0,
    }));

    const shippingAddress =
      (richOrder.shipping_address as Record<string, unknown> | null) ?? {};
    const emailData = {
      orderNumber:
        (richOrder.order_number as string) ||
        order.id.slice(0, 8).toUpperCase(),
      customerName: richOrder.customer_name as string,
      items: emailItems,
      subtotal: order.subtotal,
      shippingFee: order.shipping_fee,
      total: order.total,
      shippingAddress: {
        address: (shippingAddress.address as string) || '',
        city: (shippingAddress.city as string) || '',
        state: (shippingAddress.state as string) || '',
        phone: (richOrder.customer_phone as string) || '',
      },
      merchantName: merchantDetails.business_name ?? '',
      merchantUrl,
      merchantTin: merchantDetails.tax_identification_number ?? undefined,
      merchantRcNumber: merchantDetails.cac_rc_number ?? undefined,
    };

    const htmlContent = generateOrderConfirmationEmail(emailData);
    const textContent = generateOrderConfirmationText(emailData);
    const replyToEmail =
      merchantDetails.support_email ||
      merchantDetails.email ||
      `support@${merchantDetails.slug}.${rootDomain}`;
    const senderName = merchantDetails.email_sender_name
      ? `${merchantDetails.email_sender_name} Orders`
      : merchantDetails.business_name
        ? `${merchantDetails.business_name} Orders`
        : undefined;

    const result = await sendEmail({
      to: richOrder.customer_email as string,
      toName: richOrder.customer_name as string | undefined,
      subject: `Order Confirmation - #${emailData.orderNumber}`,
      htmlContent,
      textContent,
      replyTo: replyToEmail,
      emailType: 'orders',
      fromName: senderName,
      // Δ-61: ZeptoMail has no Idempotency-Key. The payment_side_effects
      // claim row is the dedup record; client_reference gives a server-
      // side audit trail showing which sends actually went out.
      clientReference: `order:${order.id}:paid_email`,
      auditContext: {
        merchantId: order.merchant_id,
        orderId: order.id,
        customerId: (richOrder.customer_id as string) ?? null,
        metadata: { trigger: actor },
      },
    });
    if (!result.success) {
      throw new Error(result.error || result.errorCode || 'email_failed');
    }
    return { messageId: result.messageId };
  };

  const adTrackingExecutor: StepExecutor = async () => {
    await triggerPurchaseConversion(
      supabase,
      order.merchant_id,
      richOrder as never
    );
    return {};
  };

  const settlementExecutor: StepExecutor = async (ctx) => {
    const grossAmount = Number(transaction.amount) || 0;
    // Δ-0b: source the gateway fee from the verified Paystack response
    // (passed via StepContext.gatewayResponse).
    const gatewayFee = extractVerifiedGatewayFeeNgn(
      'paystack',
      ctx.gatewayResponse
    );
    const platformFee =
      Number(rawPlatformFee) ||
      calculatePlatformFee(grossAmount * 100).platformFee / 100;

    const { error: settlementError } = await supabase.rpc(
      'record_merchant_settlement',
      {
        p_merchant_id: order.merchant_id,
        p_source_type: 'order',
        p_source_id: order.id,
        p_gateway: 'paystack',
        // Δ-22: settlement key is our BAC-*; Paystack ref → metadata only.
        p_gateway_reference:
          transaction.gateway_reference ?? paystackReference,
        p_gross_amount: grossAmount,
        p_gateway_fee: gatewayFee,
        p_platform_fee: platformFee,
        p_description: 'Order payment via paystack (manual reconcile)',
        p_metadata: {
          paystack_reference: paystackReference,
          verified_gateway_fee: gatewayFee,
          reconciled_by: actor,
        },
      }
    );
    if (settlementError) {
      throw new Error(settlementError.message);
    }
    return {
      gross_amount: grossAmount,
      gateway_fee: gatewayFee,
      platform_fee: platformFee,
    };
  };

  // Stub for steps that B3.5 wires for real. The Δ-31 consistency gate
  // short-circuits these BEFORE the executor runs for inconsistent
  // orders (Efosa); for consistent orders the stub throws and the row
  // gets `failed='wired_in_b3_5'` — replayable when the integrations
  // ship in B3.5.
  const stubExecutor: StepExecutor = () => {
    throw new Error('wired_in_b3_5');
  };

  return {
    paid_email: paidEmailExecutor,
    firs_invoice: stubExecutor,
    loyalty_points: stubExecutor,
    ad_tracking_conversion: adTrackingExecutor,
    merchant_settlement: settlementExecutor,
  };
}

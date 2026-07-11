import 'server-only';

import { randomUUID } from 'node:crypto';
import { getRootDomain } from '@/env';
import { notifyCustomer } from '@/lib/expo-push';
import type { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/zeptomail';
import { buildPetrockRemediationNotification } from './petrock-remediation-notification-content';

type AdminClient = ReturnType<typeof createAdminClient>;
type NotificationChannel = 'email' | 'push';
type NotificationStatus = 'failed' | 'sent' | 'skipped';

async function channelRpc(
  supabaseAdmin: AdminClient,
  name:
    | 'claim_petrock_remediation_notification'
    | 'complete_petrock_remediation_notification'
    | 'clear_petrock_remediation_notification',
  orderId: string,
  channel: NotificationChannel,
  claimToken: string
) {
  const { data, error } = await supabaseAdmin.rpc(name, {
    p_channel: channel,
    p_claim_token: claimToken,
    p_order_id: orderId,
    ...(name === 'claim_petrock_remediation_notification'
      ? { p_lease_seconds: 120 }
      : {}),
  });
  if (error) throw error;
  return data === true;
}

export async function notifyPetrockRemediationTerminal({
  orderId,
  supabaseAdmin,
}: {
  orderId: string;
  supabaseAdmin: AdminClient;
}): Promise<{ email: NotificationStatus; push: NotificationStatus }> {
  const { data: order, error: orderError } = await supabaseAdmin
    .from('petrock_orders')
    .select(
      'id, customer_id, merchant_id, status, carrier, payment_currency, amount_ngn, amount_usdt, customer_message'
    )
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (
    !order ||
    !['cancelled', 'completed', 'failed', 'refunded'].includes(order.status)
  ) {
    return { email: 'skipped', push: 'skipped' };
  }

  const [customerResult, merchantResult] = await Promise.all([
    supabaseAdmin
      .from('customers')
      .select('user_id, email, first_name, last_name')
      .eq('id', order.customer_id)
      .maybeSingle(),
    supabaseAdmin
      .from('merchants')
      .select('business_name, slug')
      .eq('id', order.merchant_id)
      .maybeSingle(),
  ]);
  if (customerResult.error) throw customerResult.error;
  if (merchantResult.error) throw merchantResult.error;
  const customer = customerResult.data;
  const merchant = merchantResult.data;
  if (!customer || !merchant) {
    return { email: 'skipped', push: 'skipped' };
  }

  const customerName =
    [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
    'Customer';
  const currency =
    order.payment_currency === 'NGN' || order.payment_currency === 'USDT'
      ? order.payment_currency
      : null;
  const amount =
    currency === 'NGN'
      ? Number(order.amount_ngn)
      : currency === 'USDT'
        ? Number(order.amount_usdt)
        : null;
  const rootDomain = getRootDomain() || 'usebaci.com';
  const content = buildPetrockRemediationNotification({
    amount: amount !== null && Number.isFinite(amount) ? amount : null,
    carrier: order.carrier,
    currency,
    customerName,
    merchantName: merchant.business_name || 'Baci Merchant',
    status: order.status as 'cancelled' | 'completed' | 'failed' | 'refunded',
    storefrontUrl: `https://${merchant.slug}.${rootDomain}`,
  });

  const sendEmailNotification = async (): Promise<NotificationStatus> => {
    const claimToken = randomUUID();
    const claimed = await channelRpc(
      supabaseAdmin,
      'claim_petrock_remediation_notification',
      orderId,
      'email',
      claimToken
    );
    if (!claimed) return 'skipped';
    if (!customer.email) {
      await channelRpc(
        supabaseAdmin,
        'complete_petrock_remediation_notification',
        orderId,
        'email',
        claimToken
      );
      return 'skipped';
    }
    try {
      const result = await sendEmail({
        auditContext: {
          customerId: order.customer_id,
          merchantId: order.merchant_id,
          metadata: { petrockOrderId: orderId },
        },
        emailType: 'orders',
        fromName: merchant.business_name || 'Baci Merchant',
        htmlContent: content.htmlContent,
        subject: content.subject,
        textContent: content.textContent,
        to: customer.email,
        toName: customerName,
      });
      if (result.success) {
        await channelRpc(
          supabaseAdmin,
          'complete_petrock_remediation_notification',
          orderId,
          'email',
          claimToken
        );
        return 'sent';
      }
    } catch (error) {
      console.error('[Petrock Remediation] Email notification failed', {
        error,
        orderId,
      });
    }
    await channelRpc(
      supabaseAdmin,
      'clear_petrock_remediation_notification',
      orderId,
      'email',
      claimToken
    );
    return 'failed';
  };

  const sendPushNotification = async (): Promise<NotificationStatus> => {
    const claimToken = randomUUID();
    const claimed = await channelRpc(
      supabaseAdmin,
      'claim_petrock_remediation_notification',
      orderId,
      'push',
      claimToken
    );
    if (!claimed) return 'skipped';
    if (!customer.user_id) {
      await channelRpc(
        supabaseAdmin,
        'complete_petrock_remediation_notification',
        orderId,
        'push',
        claimToken
      );
      return 'skipped';
    }
    try {
      const result = await notifyCustomer(
        customer.user_id,
        content.title,
        content.body,
        { orderId, type: 'carrier_unlock' },
        'orders'
      );
      if (result.failed === 0 && result.errors.length === 0) {
        await channelRpc(
          supabaseAdmin,
          'complete_petrock_remediation_notification',
          orderId,
          'push',
          claimToken
        );
        return 'sent';
      }
    } catch (error) {
      console.error('[Petrock Remediation] Push notification failed', {
        error,
        orderId,
      });
    }
    await channelRpc(
      supabaseAdmin,
      'clear_petrock_remediation_notification',
      orderId,
      'push',
      claimToken
    );
    return 'failed';
  };

  const [email, push] = await Promise.all([
    sendEmailNotification(),
    sendPushNotification(),
  ]);
  return { email, push };
}

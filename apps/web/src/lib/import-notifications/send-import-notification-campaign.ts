import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildReceiptClaimUrl,
  buildReceiptDeviceList,
  createReceiptClaimToken,
  normalizeClaimEmail,
  type ReceiptClaimOrderForDeviceList,
} from '@/lib/import-notifications/receipt-claim-links';
import { escapeHtml, sanitizeUrl } from '@/lib/sanitize-core';
import { sendEmail } from '@/lib/zeptomail';

interface MerchantNotificationContext {
  id: string;
  slug: string;
  business_name: string | null;
  custom_domain: string | null;
  support_email: string | null;
  email_sender_name: string | null;
  email: string | null;
}

interface NotificationOrderItem {
  name: string | null;
  quantity: number | null;
}
interface NotificationRecipientOrder {
  id: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_id: string | null;
  order_number: string;
  payment_status: string;
  shipping_status: string;
  order_items?: NotificationOrderItem[] | null;
}
interface NotificationRecipient {
  email: string;
  customerId: string | null;
  customerName: string | null;
  orders: NotificationRecipientOrder[];
}
interface SendImportNotificationCampaignInput {
  supabase: SupabaseClient;
  importJobId: string;
  merchant: MerchantNotificationContext;
  customSettings: Record<string, unknown> | null;
}
interface SendImportNotificationCampaignResult {
  sentCount: number;
  skippedCount: number;
  failedCount: number;
}

function groupOrdersByRecipient(orders: NotificationRecipientOrder[]) {
  const recipientsByEmail = new Map<string, NotificationRecipient>();

  for (const order of orders) {
    const normalizedEmail = normalizeClaimEmail(order.customer_email);
    if (!normalizedEmail) {
      continue;
    }

    const existing = recipientsByEmail.get(normalizedEmail);
    if (existing) {
      existing.orders.push(order);
      existing.customerId = existing.customerId || order.customer_id;
      existing.customerName = existing.customerName || order.customer_name;
      continue;
    }

    recipientsByEmail.set(normalizedEmail, {
      email: normalizedEmail,
      customerId: order.customer_id,
      customerName: order.customer_name,
      orders: [order],
    });
  }

  return recipientsByEmail;
}

function buildEmailContent({
  merchant,
  recipientName,
  claimUrl,
  devices,
}: {
  merchant: MerchantNotificationContext;
  recipientName: string;
  claimUrl: string;
  devices: string[];
}) {
  const merchantName = merchant.business_name || 'Your store';
  const escapedMerchantName = escapeHtml(merchantName);
  const escapedRecipientName = escapeHtml(recipientName);
  const escapedDevices = devices.map((device) => escapeHtml(device));
  const sanitizedClaimUrl = sanitizeUrl(claimUrl);
  const supportContact = escapeHtml(
    merchant.support_email || merchant.email || 'the store team'
  );
  const deviceItemsHtml = escapedDevices
    .map((device) => `<li>${device}</li>`)
    .join('');
  const textDevices = devices
    .map((device, index) => `${index + 1}. ${device}`)
    .join('\n');

  return {
    fromName: merchant.email_sender_name || merchant.business_name || 'Orders',
    subject: 'Your Receipt Has Changed.',
    htmlContent: `
      <div style="font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #15161f; line-height: 1.6; max-width: 640px; margin: 0 auto; padding: 28px; background: #fff7f7;">
        <div style="background: #ffffff; border: 1px solid #f0d7d7; border-radius: 14px; padding: 28px;">
          <p style="margin: 0 0 16px;">Hello ${escapedRecipientName},</p>
          <p style="margin: 0 0 16px;">${escapedMerchantName} has moved your receipt for the following device(s) to the mobile app.</p>
          <ol style="margin: 0 0 20px; padding-left: 22px;">${deviceItemsHtml}</ol>
          <p style="margin: 0 0 24px;">This is to ensure you can access your receipt at any time directly from the app.</p>
          <p style="margin: 0 0 24px;">
            <a href="${sanitizedClaimUrl}" style="display: inline-block; background: #e11d2e; color: #ffffff; font-weight: 700; text-decoration: none; padding: 13px 20px; border-radius: 10px;">
              View your receipt
            </a>
          </p>
          <p style="margin: 0; color: #5f6375; font-size: 14px;">If you are on mobile and have the app installed, this link opens the app. On desktop, it opens the secure web claim page.</p>
          <p style="margin: 18px 0 0; color: #5f6375; font-size: 14px;">If you need help, reply to this email or contact ${supportContact}.</p>
        </div>
      </div>
    `,
    textContent: [
      `Hello ${recipientName},`,
      '',
      `${merchantName} has moved your receipt for the following device(s) to the mobile app.`,
      textDevices,
      '',
      'This is to ensure you can access your receipt at any time directly from the app.',
      '',
      `View your receipt: ${sanitizedClaimUrl}`,
      '',
      `Need help? Contact ${merchant.support_email || merchant.email || 'the store team'}.`,
    ].join('\n'),
  };
}

async function createClaimLinkForRecipient({
  supabase,
  importJobId,
  merchant,
  recipient,
}: {
  supabase: SupabaseClient;
  importJobId: string;
  merchant: MerchantNotificationContext;
  recipient: NotificationRecipient;
}) {
  if (!recipient.customerId) {
    return null;
  }

  const normalizedEmail = normalizeClaimEmail(recipient.email);
  if (!normalizedEmail) {
    return null;
  }

  const { data: existingClaim, error: existingClaimError } = await supabase
    .from('receipt_claims')
    .select('id')
    .eq('import_job_id', importJobId)
    .eq('customer_email_normalized', normalizedEmail)
    .maybeSingle();

  if (existingClaimError) {
    throw new Error(
      `Failed to check existing receipt claim: ${existingClaimError.message}`
    );
  }

  if (existingClaim) {
    // TODO: Existing rows do not store the raw token, so failed-send retries
    // need explicit delivery state before they can safely resend claim links.
    return null;
  }

  const claimToken = createReceiptClaimToken();
  const { data: claim, error: claimError } = await supabase
    .from('receipt_claims')
    .insert({
      merchant_id: merchant.id,
      import_job_id: importJobId,
      customer_id: recipient.customerId,
      customer_email: recipient.email,
      customer_name: recipient.customerName,
      token_hash: claimToken.tokenHash,
      claimed_at: null,
      claimed_by_user_id: null,
    })
    .select('id')
    .single();

  if (claimError || !claim) {
    throw new Error(`Failed to create receipt claim: ${claimError?.message}`);
  }

  const claimOrderRows = recipient.orders.map((order) => ({
    receipt_claim_id: claim.id,
    order_id: order.id,
  }));

  if (claimOrderRows.length > 0) {
    const { error: claimOrdersError } = await supabase
      .from('receipt_claim_orders')
      .upsert(claimOrderRows, { onConflict: 'receipt_claim_id,order_id' });

    if (claimOrdersError) {
      throw new Error(
        `Failed to attach receipt claim orders: ${claimOrdersError.message}`
      );
    }
  }

  return buildReceiptClaimUrl({
    merchant,
    token: claimToken.token,
  });
}

export async function sendImportNotificationCampaign({
  supabase,
  importJobId,
  merchant,
}: SendImportNotificationCampaignInput): Promise<SendImportNotificationCampaignResult> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, customer_id, customer_email, customer_name, order_number, payment_status, shipping_status, order_items(name, quantity)'
    )
    .eq('merchant_id', merchant.id)
    .eq('import_job_id', importJobId)
    .not('customer_email', 'is', null);

  if (error) {
    throw new Error(
      `Failed to load imported order recipients: ${error.message}`
    );
  }

  const recipientsByEmail = groupOrdersByRecipient(
    (data || []) as NotificationRecipientOrder[]
  );

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const recipient of recipientsByEmail.values()) {
    const claimUrl = await createClaimLinkForRecipient({
      supabase,
      importJobId,
      merchant,
      recipient,
    });

    if (!claimUrl) {
      skippedCount += 1;
      continue;
    }

    const devices = buildReceiptDeviceList(
      recipient.orders as ReceiptClaimOrderForDeviceList[]
    );
    const content = buildEmailContent({
      merchant,
      recipientName: recipient.customerName || 'there',
      claimUrl,
      devices,
    });

    const result = await sendEmail({
      to: recipient.email,
      toName: recipient.customerName || undefined,
      subject: content.subject,
      htmlContent: content.htmlContent,
      textContent: content.textContent,
      replyTo: merchant.support_email || merchant.email || undefined,
      emailType: 'orders',
      fromName: content.fromName,
    });

    if (result.success) {
      sentCount += 1;
      continue;
    }

    failedCount += 1;
  }

  return {
    sentCount,
    skippedCount,
    failedCount,
  };
}

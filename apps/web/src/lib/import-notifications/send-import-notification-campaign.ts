import type { SupabaseClient } from '@supabase/supabase-js';
import { MOBILE_APPS } from '@/config/platform';
import { getRootDomain } from '@/env';
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

interface NotificationRecipientOrder {
  customer_email: string | null;
  customer_name: string | null;
  customer_id: string | null;
  order_number: string;
  payment_status: string;
  shipping_status: string;
}

interface SendImportNotificationCampaignInput {
  supabase: SupabaseClient;
  importJobId: string;
  merchant: MerchantNotificationContext;
  customSettings: Record<string, unknown> | null;
}

interface DeliveryConfig {
  accessMode: 'site' | 'app_first';
  receiptsUrl: string;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
}

interface SendImportNotificationCampaignResult {
  sentCount: number;
  skippedCount: number;
  failedCount: number;
}

function buildStorefrontUrl(merchant: MerchantNotificationContext) {
  if (merchant.custom_domain) {
    return `https://${merchant.custom_domain.replace(/\/$/, '')}`;
  }

  const rootDomain = getRootDomain() || 'usebaci.com';
  return `https://${merchant.slug}.${rootDomain}`;
}

function resolveDeliveryConfig(
  merchant: MerchantNotificationContext,
  customSettings: Record<string, unknown> | null
): DeliveryConfig {
  const migrationSettings = (customSettings?.migration_imports || {}) as Record<
    string,
    unknown
  >;
  const configuredAccessMode = migrationSettings.receipt_access_mode;
  const accessMode =
    configuredAccessMode === 'app_first' || configuredAccessMode === 'site'
      ? configuredAccessMode
      : merchant.slug === 'ogabassey'
        ? 'app_first'
        : 'site';

  const receiptPath =
    typeof migrationSettings.receipt_path === 'string' &&
    migrationSettings.receipt_path.startsWith('/')
      ? migrationSettings.receipt_path
      : '/receipts';

  const receiptsUrl = `${buildStorefrontUrl(merchant)}${receiptPath}`;
  const appStoreUrl =
    typeof migrationSettings.app_store_url === 'string'
      ? migrationSettings.app_store_url
      : MOBILE_APPS.storefront.appStoreUrl || null;
  const playStoreUrl =
    typeof migrationSettings.play_store_url === 'string'
      ? migrationSettings.play_store_url
      : MOBILE_APPS.storefront.playStoreUrl || null;

  return {
    accessMode,
    receiptsUrl,
    appStoreUrl,
    playStoreUrl,
  };
}

function buildEmailContent(
  merchant: MerchantNotificationContext,
  recipientName: string,
  delivery: DeliveryConfig
) {
  const merchantName = merchant.business_name || 'Your store';
  const fromName =
    merchant.email_sender_name || merchant.business_name || 'Orders';
  const subject =
    delivery.accessMode === 'app_first'
      ? `${merchantName}: your updated receipt is ready`
      : `${merchantName}: your updated order history is ready`;
  const secondaryLinks = [
    delivery.playStoreUrl
      ? `<a href="${delivery.playStoreUrl}">Google Play</a>`
      : '',
    delivery.appStoreUrl
      ? `<a href="${delivery.appStoreUrl}">App Store</a>`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const actionCopy =
    delivery.accessMode === 'app_first'
      ? `Open the ${merchantName} app to view your updated receipt or invoice. If the app is not installed, this link will open the website.`
      : 'Sign in to view your imported order history and download your updated receipt or invoice.';

  const htmlContent = `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #111827; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
      <p>Hello ${recipientName},</p>
      <p>${merchantName} has moved your previous order history into a new account experience.</p>
      <p>${actionCopy}</p>
      <p style="margin: 24px 0;">
        <a href="${delivery.receiptsUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px;">
          View My Orders
        </a>
      </p>
      ${secondaryLinks ? `<p>Download options: ${secondaryLinks}</p>` : ''}
      <p>If you need help, reply to this email or contact ${merchant.support_email || merchant.email || 'the store team'}.</p>
    </div>
  `;

  const textContent = [
    `Hello ${recipientName},`,
    '',
    `${merchantName} has moved your previous order history into a new account experience.`,
    actionCopy,
    '',
    `View your orders: ${delivery.receiptsUrl}`,
    secondaryLinks
      ? `Download options: ${secondaryLinks.replace(/<[^>]+>/g, '')}`
      : '',
    `Need help? Contact ${merchant.support_email || merchant.email || 'the store team'}.`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    fromName,
    subject,
    htmlContent,
    textContent,
  };
}

export async function sendImportNotificationCampaign({
  supabase,
  importJobId,
  merchant,
  customSettings,
}: SendImportNotificationCampaignInput): Promise<SendImportNotificationCampaignResult> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'customer_id, customer_email, customer_name, order_number, payment_status, shipping_status'
    )
    .eq('merchant_id', merchant.id)
    .eq('import_job_id', importJobId)
    .not('customer_email', 'is', null);

  if (error) {
    throw new Error(
      `Failed to load imported order recipients: ${error.message}`
    );
  }

  const deliveryConfig = resolveDeliveryConfig(merchant, customSettings);
  const recipientsByEmail = new Map<string, NotificationRecipientOrder>();

  for (const order of (data || []) as NotificationRecipientOrder[]) {
    if (!order.customer_email || recipientsByEmail.has(order.customer_email)) {
      continue;
    }

    recipientsByEmail.set(order.customer_email, order);
  }

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const [email, order] of recipientsByEmail.entries()) {
    if (!order.customer_id) {
      skippedCount += 1;
      continue;
    }

    const content = buildEmailContent(
      merchant,
      order.customer_name || 'there',
      deliveryConfig
    );

    const result = await sendEmail({
      to: email,
      toName: order.customer_name || undefined,
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

import { MOBILE_APPS } from '@/config/platform';
import { getRootDomain } from '@/env';
import { escapeHtml, sanitizeUrl } from '@/lib/sanitize-core';

export interface MerchantNotificationContext {
  id: string;
  slug: string;
  business_name: string | null;
  custom_domain: string | null;
  support_email: string | null;
  email_sender_name: string | null;
  email: string | null;
}

export interface ReceiptNotificationDeliveryConfig {
  accessMode: 'site' | 'app_first';
  receiptsUrl: string;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
}

interface BuildReceiptNotificationEmailContentInput {
  merchant: MerchantNotificationContext;
  recipientName: string;
  delivery: ReceiptNotificationDeliveryConfig;
  claimUrl: string;
  devices: string[];
}

const DEFAULT_NOTIFICATION_SOURCE: ReceiptNotificationDeliveryConfig['accessMode'] =
  'site';
const RECEIPT_CHANGED_SUBJECT = 'Your Receipt has Changed.';

function isOgabasseyMerchant(merchant: MerchantNotificationContext) {
  const slug = merchant.slug.trim().toLowerCase();
  const domain = merchant.custom_domain?.trim().toLowerCase() || '';

  return (
    slug === 'ogabassey' ||
    domain === 'ogabassey.com' ||
    domain === 'www.ogabassey.com'
  );
}

function buildStorefrontUrl(merchant: MerchantNotificationContext) {
  if (merchant.custom_domain) {
    return `https://${merchant.custom_domain.replace(/\/$/, '')}`;
  }

  const rootDomain = getRootDomain() || 'usebaci.com';
  return `https://${merchant.slug}.${rootDomain}`;
}

export function resolveReceiptNotificationDelivery(
  merchant: MerchantNotificationContext,
  customSettings: Record<string, unknown> | null
): ReceiptNotificationDeliveryConfig {
  const migrationSettings = (customSettings?.migration_imports || {}) as Record<
    string,
    unknown
  >;
  const isOgabassey = isOgabasseyMerchant(merchant);
  const configuredAccessMode = migrationSettings.receipt_access_mode;
  const accessMode =
    isOgabassey && configuredAccessMode === 'app_first'
      ? configuredAccessMode
      : configuredAccessMode === 'site'
        ? configuredAccessMode
        : DEFAULT_NOTIFICATION_SOURCE;

  const receiptPath =
    typeof migrationSettings.receipt_path === 'string' &&
    migrationSettings.receipt_path.startsWith('/')
      ? migrationSettings.receipt_path
      : '/receipts';

  const appStoreUrl =
    accessMode === 'app_first' &&
    typeof migrationSettings.app_store_url === 'string'
      ? migrationSettings.app_store_url
      : accessMode === 'app_first'
        ? MOBILE_APPS.storefront.appStoreUrl || null
        : null;
  const playStoreUrl =
    accessMode === 'app_first' &&
    typeof migrationSettings.play_store_url === 'string'
      ? migrationSettings.play_store_url
      : accessMode === 'app_first'
        ? MOBILE_APPS.storefront.playStoreUrl || null
        : null;

  return {
    accessMode,
    receiptsUrl: `${buildStorefrontUrl(merchant)}${receiptPath}`,
    appStoreUrl,
    playStoreUrl,
  };
}

export function buildReceiptNotificationEmailContent({
  merchant,
  recipientName,
  delivery,
  claimUrl,
  devices,
}: BuildReceiptNotificationEmailContentInput) {
  if (delivery.accessMode === 'site') {
    return buildSiteReceiptEmailContent({
      delivery,
      devices,
      merchant,
      recipientName,
    });
  }

  return buildAppFirstReceiptEmailContent({
    claimUrl,
    devices,
    merchant,
    recipientName,
  });
}

function buildAppFirstReceiptEmailContent({
  merchant,
  recipientName,
  claimUrl,
  devices,
}: Pick<
  BuildReceiptNotificationEmailContentInput,
  'merchant' | 'recipientName' | 'claimUrl' | 'devices'
>) {
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
  const claimActionHtml = sanitizedClaimUrl
    ? `<p style="margin: 0 0 24px;">
            <a href="${sanitizedClaimUrl}" style="display: inline-block; background: #111827; color: #ffffff; font-weight: 700; text-decoration: none; padding: 13px 20px; border-radius: 10px;">
              View your receipt
            </a>
          </p>`
    : '<p style="margin: 0 0 24px; color: #5f6375; font-size: 14px;">Receipt link unavailable (invalid link configuration).</p>';

  return {
    fromName: merchant.email_sender_name || merchant.business_name || 'Orders',
    subject: RECEIPT_CHANGED_SUBJECT,
    htmlContent: `
      <div style="font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.6; max-width: 640px; margin: 0 auto; padding: 28px; background: #f8fafc;">
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 28px;">
          <p style="margin: 0 0 16px;">Hello ${escapedRecipientName},</p>
          <p style="margin: 0 0 16px;">${escapedMerchantName} has moved your receipt for the following device(s) to the mobile app.</p>
          <ol style="margin: 0 0 20px; padding-left: 22px;">${deviceItemsHtml}</ol>
          <p style="margin: 0 0 24px;">This is to ensure you can access your receipt at any time directly from the app.</p>
          ${claimActionHtml}
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
      sanitizedClaimUrl
        ? `View your receipt: ${sanitizedClaimUrl}`
        : 'View your receipt: unavailable (invalid link configuration).',
      '',
      `Need help? Contact ${merchant.support_email || merchant.email || 'the store team'}.`,
    ].join('\n'),
  };
}

function buildSiteReceiptEmailContent({
  merchant,
  recipientName,
  delivery,
  devices,
}: Pick<
  BuildReceiptNotificationEmailContentInput,
  'merchant' | 'recipientName' | 'delivery' | 'devices'
>) {
  const merchantName = merchant.business_name || 'Your store';
  const escapedMerchantName = escapeHtml(merchantName);
  const escapedRecipientName = escapeHtml(recipientName);
  const escapedDevices = devices.map((device) => escapeHtml(device));
  const supportContact = escapeHtml(
    merchant.support_email || merchant.email || 'the store team'
  );
  const sanitizedReceiptsUrl = sanitizeUrl(delivery.receiptsUrl);
  const deviceItemsHtml = escapedDevices
    .map((device) => `<li>${device}</li>`)
    .join('');
  const textDevices = devices
    .map((device, index) => `${index + 1}. ${device}`)
    .join('\n');

  return {
    fromName: merchant.email_sender_name || merchant.business_name || 'Orders',
    subject: RECEIPT_CHANGED_SUBJECT,
    htmlContent: `
      <div style="font-family: system-ui, -apple-system, sans-serif; color: #111827; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
        <p>Hello ${escapedRecipientName},</p>
        <p>${escapedMerchantName} has moved your receipt for the following item(s) to your online account.</p>
        <ol style="margin: 12px 0 20px; padding-left: 22px;">${deviceItemsHtml}</ol>
        <p>This is to ensure you can access your receipt at any time from the website.</p>
        <p style="margin: 24px 0;">
          <a href="${sanitizedReceiptsUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px;">
            View your receipt
          </a>
        </p>
        <p>If you need help, reply to this email or contact ${supportContact}.</p>
      </div>
    `,
    textContent: [
      `Hello ${recipientName},`,
      '',
      `${merchantName} has moved your receipt for the following item(s) to your online account.`,
      textDevices,
      '',
      'This is to ensure you can access your receipt at any time from the website.',
      '',
      sanitizedReceiptsUrl
        ? `View your receipt: ${sanitizedReceiptsUrl}`
        : 'View your receipt: unavailable (invalid link configuration).',
      `Need help? Contact ${merchant.support_email || merchant.email || 'the store team'}.`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

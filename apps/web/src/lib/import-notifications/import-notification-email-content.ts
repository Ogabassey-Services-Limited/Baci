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
  const configuredAccessMode = migrationSettings.receipt_access_mode;
  const accessMode =
    configuredAccessMode === 'app_first' || configuredAccessMode === 'site'
      ? configuredAccessMode
      : DEFAULT_NOTIFICATION_SOURCE;

  const receiptPath =
    typeof migrationSettings.receipt_path === 'string' &&
    migrationSettings.receipt_path.startsWith('/')
      ? migrationSettings.receipt_path
      : '/receipts';

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
    return buildSiteReceiptEmailContent({ delivery, merchant, recipientName });
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

function buildSiteReceiptEmailContent({
  merchant,
  recipientName,
  delivery,
}: Pick<
  BuildReceiptNotificationEmailContentInput,
  'merchant' | 'recipientName' | 'delivery'
>) {
  const merchantName = merchant.business_name || 'Your store';
  const escapedMerchantName = escapeHtml(merchantName);
  const escapedRecipientName = escapeHtml(recipientName);
  const supportContact = escapeHtml(
    merchant.support_email || merchant.email || 'the store team'
  );
  const sanitizedReceiptsUrl = sanitizeUrl(delivery.receiptsUrl);
  const sanitizedPlayStoreUrl = delivery.playStoreUrl
    ? sanitizeUrl(delivery.playStoreUrl)
    : '';
  const sanitizedAppStoreUrl = delivery.appStoreUrl
    ? sanitizeUrl(delivery.appStoreUrl)
    : '';
  const secondaryLinks = [
    sanitizedPlayStoreUrl
      ? `<a href="${sanitizedPlayStoreUrl}">Google Play</a>`
      : '',
    sanitizedAppStoreUrl
      ? `<a href="${sanitizedAppStoreUrl}">App Store</a>`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const actionCopy =
    'Sign in to view your imported order history and download your updated receipt or invoice.';

  return {
    fromName: merchant.email_sender_name || merchant.business_name || 'Orders',
    subject: `${merchantName}: your updated order history is ready`,
    htmlContent: `
      <div style="font-family: system-ui, -apple-system, sans-serif; color: #111827; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
        <p>Hello ${escapedRecipientName},</p>
        <p>${escapedMerchantName} has moved your previous order history into a new account experience.</p>
        <p>${escapeHtml(actionCopy)}</p>
        <p style="margin: 24px 0;">
          <a href="${sanitizedReceiptsUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px;">
            View My Orders
          </a>
        </p>
        ${secondaryLinks ? `<p>Download options: ${secondaryLinks}</p>` : ''}
        <p>If you need help, reply to this email or contact ${supportContact}.</p>
      </div>
    `,
    textContent: [
      `Hello ${recipientName},`,
      '',
      `${merchantName} has moved your previous order history into a new account experience.`,
      actionCopy,
      '',
      sanitizedReceiptsUrl
        ? `View your orders: ${sanitizedReceiptsUrl}`
        : 'View your orders: unavailable (invalid link configuration).',
      secondaryLinks
        ? `Download options: ${secondaryLinks.replace(/<[^>]+>/g, '')}`
        : '',
      `Need help? Contact ${merchant.support_email || merchant.email || 'the store team'}.`,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

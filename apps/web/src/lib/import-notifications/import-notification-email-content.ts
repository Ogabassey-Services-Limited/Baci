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
  requiresReceiptClaim: boolean;
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
  const appLinksEnabled = migrationSettings.receipt_app_links_enabled === true;
  const configuredAppFirst = configuredAccessMode === 'app_first';
  const shouldUseAppFirstCopy = appLinksEnabled && configuredAppFirst;
  const shouldUseWebClaimLink = configuredAppFirst && !appLinksEnabled;
  const accessMode = shouldUseAppFirstCopy
    ? configuredAccessMode
    : configuredAccessMode === 'site' || configuredAppFirst
      ? 'site'
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
    requiresReceiptClaim: shouldUseAppFirstCopy || shouldUseWebClaimLink,
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
      claimUrl,
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
    .map(
      (device, index) => `
        <tr>
          <td style="padding: 0 0 10px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: separate; border-spacing: 0; background: #ffffff; border: 1px solid #f1d6c9; border-radius: 14px;">
              <tr>
                <td width="42" valign="top" style="padding: 14px 0 14px 14px;">
                  <div style="width: 28px; height: 28px; border-radius: 999px; background: #111827; color: #ffffff; font-size: 13px; font-weight: 800; line-height: 28px; text-align: center;">${index + 1}</div>
                </td>
                <td style="padding: 14px 16px 14px 10px; color: #1f2937; font-size: 15px; font-weight: 700; line-height: 1.45;">${device}</td>
              </tr>
            </table>
          </td>
        </tr>`
    )
    .join('');
  const textDevices = devices
    .map((device, index) => `${index + 1}. ${device}`)
    .join('\n');
  const claimActionHtml = sanitizedClaimUrl
    ? `<a href="${sanitizedClaimUrl}" style="display: inline-block; background: #dc2626; color: #ffffff; font-size: 16px; font-weight: 800; letter-spacing: 0.01em; line-height: 1; text-decoration: none; padding: 17px 24px; border-radius: 14px; box-shadow: 0 12px 24px rgba(220, 38, 38, 0.22);">View your receipt</a>`
    : '<span style="color: #7f1d1d; font-size: 14px; font-weight: 700;">Receipt link unavailable (invalid link configuration).</span>';

  return {
    fromName: merchant.email_sender_name || merchant.business_name || 'Orders',
    subject: RECEIPT_CHANGED_SUBJECT,
    htmlContent: `
      <div style="margin: 0; padding: 0; background: #160f12; font-family: Arial, Helvetica, sans-serif;">
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">Your receipt has moved to the ${escapedMerchantName} app. Open it securely from this email.</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #160f12; border-collapse: collapse; font-family: Arial, Helvetica, sans-serif;">
          <tr>
            <td align="center" style="padding: 34px 16px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; border-collapse: separate; border-spacing: 0; overflow: hidden; background: #fffaf4; border-radius: 28px;">
                <tr>
                  <td style="padding: 28px 28px 22px; background: #111827;">
                    <p style="margin: 0 0 18px; color: #fbbf24; font-size: 12px; font-weight: 900; letter-spacing: 0.18em; text-transform: uppercase;">${escapedMerchantName} Receipt Vault</p>
                    <h1 style="margin: 0; color: #ffffff; font-family: Georgia, 'Times New Roman', serif; font-size: 34px; line-height: 1.05; font-weight: 700;">Your Receipt has Changed.</h1>
                    <p style="margin: 16px 0 0; color: #f3e7d4; font-size: 16px; line-height: 1.6;">Hello ${escapedRecipientName}, ${escapedMerchantName} has moved your receipt for the following device(s) to the mobile app.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 28px 28px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: -18px 0 22px; border-collapse: separate; border-spacing: 0; background: #ffffff; border: 1px solid #f1d6c9; border-radius: 18px;">
                      <tr>
                        <td style="padding: 18px 20px;">
                          <p style="margin: 0; color: #991b1b; font-size: 12px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;">Receipt moved to app</p>
                          <p style="margin: 6px 0 0; color: #374151; font-size: 14px; line-height: 1.55;">This keeps your receipt available whenever you need it, directly from the app on mobile or through a secure claim page on desktop.</p>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0 0 12px; color: #111827; font-size: 14px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase;">Device receipts</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin: 0 0 18px;">${deviceItemsHtml}</table>
                    <div style="padding: 20px; background: #111827; border-radius: 20px; text-align: center;">
                      <p style="margin: 0 0 16px; color: #fef3c7; font-size: 14px; line-height: 1.55;">Open your receipt, set your access, and view it in the receipts panel.</p>
                      ${claimActionHtml}
                    </div>
                    <p style="margin: 18px 0 0; color: #6b7280; font-size: 13px; line-height: 1.55;">If you are on mobile and have the app installed, this link opens the app. On desktop, it opens the secure web claim page.</p>
                    <p style="margin: 10px 0 0; color: #6b7280; font-size: 13px; line-height: 1.55;">Need help? Reply to this email or contact ${supportContact}.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
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
  claimUrl,
  devices,
}: Pick<
  BuildReceiptNotificationEmailContentInput,
  'merchant' | 'recipientName' | 'delivery' | 'devices' | 'claimUrl'
>) {
  const merchantName = merchant.business_name || 'Your store';
  const escapedMerchantName = escapeHtml(merchantName);
  const escapedRecipientName = escapeHtml(recipientName);
  const escapedDevices = devices.map((device) => escapeHtml(device));
  const supportContact = escapeHtml(
    merchant.support_email || merchant.email || 'the store team'
  );
  const sanitizedReceiptsUrl = sanitizeUrl(claimUrl || delivery.receiptsUrl);
  const deviceItemsHtml = escapedDevices
    .map((device) => `<li>${device}</li>`)
    .join('');
  const textDevices = devices
    .map((device, index) => `${index + 1}. ${device}`)
    .join('\n');
  const receiptActionHtml = sanitizedReceiptsUrl
    ? `<p style="margin: 24px 0;">
          <a href="${sanitizedReceiptsUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px;">
            View your receipt
          </a>
        </p>`
    : '<p style="margin: 24px 0; color: #5f6375; font-size: 14px;">Receipt link unavailable (invalid link configuration).</p>';

  return {
    fromName: merchant.email_sender_name || merchant.business_name || 'Orders',
    subject: RECEIPT_CHANGED_SUBJECT,
    htmlContent: `
      <div style="font-family: system-ui, -apple-system, sans-serif; color: #111827; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
        <p>Hello ${escapedRecipientName},</p>
        <p>${escapedMerchantName} has moved your receipt for the following item(s) to your online account.</p>
        <ol style="margin: 12px 0 20px; padding-left: 22px;">${deviceItemsHtml}</ol>
        <p>This is to ensure you can access your receipt at any time from the website.</p>
        ${receiptActionHtml}
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
      '',
      `Need help? Contact ${merchant.support_email || merchant.email || 'the store team'}.`,
    ].join('\n'),
  };
}

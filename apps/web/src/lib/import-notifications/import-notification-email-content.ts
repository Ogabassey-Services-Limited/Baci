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

const DEFAULT_NOTIFICATION_SOURCE = 'site';
const RECEIPT_CHANGED_SUBJECT = 'Your Receipt has Changed.';
const APP_FIRST_RECEIPT_THEME =
  '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><style>:root{color-scheme:light dark;supported-color-schemes:light dark}@media (prefers-color-scheme:dark){.receipt-bg{background:#120d0b!important}.receipt-card{background:#181310!important;border-color:#3d2d25!important}.receipt-panel{background:#211915!important;border-color:#4a372d!important}.receipt-text{color:#fff7ed!important}.receipt-muted{color:#d9c8bc!important}.receipt-rule{border-color:#4a372d!important}.receipt-pill{color:#ffd8cf!important;border-color:#4a372d!important}.receipt-link{color:#ff9b92!important}}</style>';

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
  const sanitizedContactUrl = sanitizeUrl(
    `${buildStorefrontUrl(merchant)}/contact`
  );
  const contactUsHtml = sanitizedContactUrl
    ? `<a class="receipt-link" href="${sanitizedContactUrl}" style="color: #b91c1c; font-weight: 800; text-decoration: underline;">contact us</a>`
    : 'contact us';
  const contactUsText = `contact us${sanitizedContactUrl ? `: ${sanitizedContactUrl}` : ''}`;
  const receiptAccessCopy =
    'This ensures you can access the receipts for your devices purchased from us at any time in case you need them for support, warranty, or as proof of purchase.';
  const deviceItemsHtml = escapedDevices
    .map(
      (device, index) => `
        <tr>
          <td class="receipt-rule" style="padding: ${index === 0 ? '4px' : '16px'} 28px 16px; border-bottom: 1px dashed #e5d5c8;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
              <tr>
                <td valign="top" width="40" style="color: #b91c1c; font-size: 13px; font-weight: 800; line-height: 1.45;">${index + 1}.</td>
                <td class="receipt-text" style="color: #111827; font-size: 15px; font-weight: 800; line-height: 1.45;">${device}</td>
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
    ? `<a href="${sanitizedClaimUrl}" style="display: inline-block; background: #d71920; color: #ffffff; font-size: 15px; font-weight: 800; line-height: 1; text-decoration: none; padding: 16px 24px; border-radius: 999px;">View Receipt</a>`
    : '<span style="color: #7f1d1d; font-size: 14px; font-weight: 700;">Receipt link unavailable (invalid link configuration).</span>';
  const claimActionText = sanitizedClaimUrl
    ? `View Receipt: ${sanitizedClaimUrl}`
    : 'View Receipt: unavailable (invalid link configuration).';

  return {
    fromName: merchant.email_sender_name || merchant.business_name || 'Orders',
    subject: RECEIPT_CHANGED_SUBJECT,
    htmlContent: `
      ${APP_FIRST_RECEIPT_THEME}<div class="receipt-bg" style="margin: 0; padding: 0; background: #f3eee8; font-family: Arial, Helvetica, sans-serif;">
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">Your receipt has moved to the ${escapedMerchantName} app. View it securely from this email.</div>
        <table class="receipt-bg" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f3eee8; border-collapse: collapse; font-family: Arial, Helvetica, sans-serif;">
          <tr>
            <td align="center" style="padding: 32px 16px;">
              <table class="receipt-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 620px; border-collapse: separate; border-spacing: 0; overflow: hidden; background: #fffdf8; border: 1px solid #eadfd4; border-radius: 18px;">
                <tr>
                  <td style="height: 6px; background: #d71920; line-height: 6px; font-size: 0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding: 30px 30px 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin: 0 0 24px;">
                      <tr>
                        <td width="54" valign="top">
                          <div style="width: 42px; height: 42px; border-radius: 12px; background: #d71920; color: #ffffff; font-size: 13px; font-weight: 900; letter-spacing: 0.08em; line-height: 42px; text-align: center;">OG</div>
                        </td>
                        <td valign="middle">
                          <p class="receipt-text" style="margin: 0; color: #111827; font-size: 15px; font-weight: 900;">${escapedMerchantName}</p>
                          <p style="margin: 3px 0 0; color: #991b1b; font-size: 11px; font-weight: 900; letter-spacing: 0.14em; text-transform: uppercase;">Digital receipt update</p>
                        </td>
                        <td align="right" valign="middle">
                          <span class="receipt-pill" style="display: inline-block; border: 1px solid #eadfd4; border-radius: 999px; color: #6b4f3f; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; padding: 7px 10px; text-transform: uppercase;">Moved to app</span>
                        </td>
                      </tr>
                    </table>
                    <h1 class="receipt-text" style="margin: 0; color: #111827; font-family: Georgia, 'Times New Roman', serif; font-size: 32px; line-height: 1.12; font-weight: 700;">Your Receipt has Changed.</h1>
                    <p class="receipt-muted" style="margin: 18px 0 0; color: #374151; font-size: 16px; line-height: 1.65;">Hello ${escapedRecipientName},</p>
                    <p class="receipt-muted" style="margin: 10px 0 0; color: #374151; font-size: 16px; line-height: 1.65;">${escapedMerchantName} has moved your receipt for the following device(s) to the mobile app.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 30px 30px;">
                    <table class="receipt-panel" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: separate; border-spacing: 0; background: #ffffff; border: 1px solid #eadfd4; border-radius: 16px;">
                      ${deviceItemsHtml}
                    </table>
                    <p class="receipt-text" style="margin: 20px 0 0; color: #1f2937; font-size: 14px; line-height: 1.7;">${escapeHtml(receiptAccessCopy)}</p>
                    <div style="padding: 24px 0 4px; text-align: center;">
                      ${claimActionHtml}
                    </div>
                    <p class="receipt-text" style="margin: 20px 0 0; color: #1f2937; font-size: 14px; line-height: 1.6; text-align: center;">Thank you for choosing ${escapedMerchantName}.</p>
                    <p style="margin: 6px 0 0; color: #991b1b; font-size: 15px; font-weight: 900; line-height: 1.5; text-align: center;">${escapedMerchantName} Never Disappoints!</p>
                    <p class="receipt-muted receipt-rule" style="margin: 18px 0 0; padding-top: 16px; border-top: 1px solid #eadfd4; color: #6b7280; font-size: 13px; line-height: 1.55;">Need help? Reply to this email or ${contactUsHtml}.</p>
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
      '',
      textDevices,
      '',
      receiptAccessCopy,
      '',
      claimActionText,
      '',
      `Thank you for choosing ${merchantName}.`,
      '',
      `${merchantName} Never Disappoints!`,
      '',
      `Need help? Reply to this email or ${contactUsText}.`,
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

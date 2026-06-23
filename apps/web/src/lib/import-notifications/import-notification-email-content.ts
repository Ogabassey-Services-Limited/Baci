import { MOBILE_APPS } from '@/config/platform';
import { getRootDomain } from '@/env';
import {
  renderReceiptCta,
  renderReceiptDeviceRows,
  renderReceiptEmailHtml,
} from '@/lib/import-notifications/import-notification-email-template';
import { escapeHtmlAttribute } from '@/lib/sanitize';
import { sanitizeUrl } from '@/lib/sanitize-core';

export interface MerchantBrandColors {
  primary?: string | null;
  accent?: string | null;
  background?: string | null;
}

export interface MerchantNotificationContext {
  id: string;
  slug: string;
  business_name: string | null;
  custom_domain: string | null;
  support_email: string | null;
  email_sender_name: string | null;
  email: string | null;
  brand_colors?: MerchantBrandColors | null;
  logo_url?: string | null;
}

export interface ReceiptNotificationDeliveryConfig {
  accessMode: 'site' | 'app_first';
  receiptsUrl: string;
  playStoreUrl: string | null;
  appStoreUrl: string | null;
  requiresReceiptClaim: boolean;
  receiptTagline: string | null;
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
const RECEIPT_CHANGED_SUBJECT = 'Your receipt has moved';
const DEFAULT_RECEIPT_BRAND_COLOR = '#d62027';
const RECEIPT_TAGLINE_MAX_LENGTH = 120;
const RASTER_LOGO_PATTERN = /\.(png|jpe?g|gif|webp)$/;
const OGABASSEY_EMAIL_LOGO_URL =
  'https://ogabassey.com/email/ogabassey-logo-white-chip.png';

function normalizeEmailHexColor(value: string | null | undefined) {
  if (!value || !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value)) {
    return DEFAULT_RECEIPT_BRAND_COLOR;
  }
  return value;
}

function getReceiptBrandColor(merchant: MerchantNotificationContext) {
  return normalizeEmailHexColor(
    merchant.brand_colors?.primary ?? merchant.brand_colors?.accent
  );
}

/**
 * Resolve an email-safe logo URL. Returns '' for missing, unsafe, or
 * non-raster URLs — email clients (Gmail/Outlook/Apple Mail) do not render
 * SVGs, so those fall back to the text wordmark.
 */
function isOgabasseyMerchant(merchant: MerchantNotificationContext): boolean {
  const slug = merchant.slug?.toLowerCase();
  const customDomain = merchant.custom_domain
    ?.toLowerCase()
    .replace(/^www\./, '');

  return slug === 'ogabassey' || customDomain === 'ogabassey.com';
}

function emailSafeLogoUrl(merchant: MerchantNotificationContext): string {
  if (isOgabasseyMerchant(merchant)) {
    return OGABASSEY_EMAIL_LOGO_URL;
  }

  if (!merchant.logo_url) {
    return '';
  }
  const safe = sanitizeUrl(merchant.logo_url);
  if (!safe) {
    return '';
  }
  const path = safe.split('?')[0].split('#')[0].toLowerCase();
  return RASTER_LOGO_PATTERN.test(path) ? safe : '';
}

function readReceiptTagline(migrationSettings: Record<string, unknown>) {
  const configuredTagline = migrationSettings.receipt_tagline;
  if (typeof configuredTagline !== 'string') {
    return null;
  }
  const trimmedTagline = configuredTagline.trim();
  return trimmedTagline
    ? trimmedTagline.slice(0, RECEIPT_TAGLINE_MAX_LENGTH)
    : null;
}

/**
 * Build the footer support sentence. When the contact looks like an email it is
 * rendered as a mailto link; otherwise it falls back to plain escaped text.
 */
function buildReceiptSupportLine(
  rawContact: string,
  escapedContact: string,
  brandColor: string
): string {
  const contactHtml = rawContact.includes('@')
    ? `<a class="r-link" href="mailto:${escapedContact}" style="color:${brandColor};font-weight:600;text-decoration:none;">${escapedContact}</a>`
    : escapedContact;
  return `Need a hand? Reach our team at ${contactHtml}.`;
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
    receiptTagline: readReceiptTagline(migrationSettings),
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
    delivery,
    devices,
    merchant,
    recipientName,
  });
}

function buildAppFirstReceiptEmailContent({
  merchant,
  recipientName,
  delivery,
  claimUrl,
  devices,
}: Pick<
  BuildReceiptNotificationEmailContentInput,
  'merchant' | 'recipientName' | 'delivery' | 'claimUrl' | 'devices'
>) {
  const merchantName = merchant.business_name || 'Your store';
  const brandColor = getReceiptBrandColor(merchant);
  const escapedMerchantName = escapeHtmlAttribute(merchantName);
  const escapedRecipientName = escapeHtmlAttribute(recipientName);
  const escapedDevices = devices.map((device) => escapeHtmlAttribute(device));
  const sanitizedClaimUrl = sanitizeUrl(claimUrl);
  const rawSupport =
    merchant.support_email || merchant.email || 'the store team';
  const supportContact = escapeHtmlAttribute(rawSupport);
  // Only render a tagline the merchant actually configured — never invent one.
  const footerNote = delivery.receiptTagline
    ? escapeHtmlAttribute(delivery.receiptTagline)
    : escapedMerchantName;
  const textDevices = devices
    .map((device, index) => `${index + 1}. ${device}`)
    .join('\n');

  return {
    fromName: merchant.email_sender_name || merchant.business_name || 'Orders',
    subject: RECEIPT_CHANGED_SUBJECT,
    htmlContent: renderReceiptEmailHtml({
      preheader: `Your ${escapedMerchantName} receipt is now in the app. Open it securely from this email.`,
      brandWordmark: escapedMerchantName,
      brandColor,
      eyebrow: 'Receipt',
      headline: 'Your receipt is now in the app',
      subhead:
        'A quicker, more secure way to keep your purchase records in one place.',
      greetingName: escapedRecipientName,
      logoUrl: escapeHtmlAttribute(emailSafeLogoUrl(merchant)),
      introHtml: `${escapedMerchantName} has moved your receipt for the following device(s) to the mobile app.`,
      sectionLabel: 'On this receipt',
      deviceRowsHtml: renderReceiptDeviceRows(escapedDevices, brandColor),
      ctaHtml: renderReceiptCta(
        escapeHtmlAttribute(sanitizedClaimUrl),
        'View your receipt',
        brandColor
      ),
      reassurance:
        'This ensures you can access the receipts for your devices purchased from us at any time in case you need them for support, warranty, or as proof of purchase.',
      supportLineHtml: buildReceiptSupportLine(
        rawSupport,
        supportContact,
        brandColor
      ),
      footerNote,
    }),
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
      `Thank you for choosing ${merchantName}.`,
      ...(delivery.receiptTagline ? [delivery.receiptTagline] : []),
      '',
      `Need help? Contact ${rawSupport}.`,
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
  const brandColor = getReceiptBrandColor(merchant);
  const escapedMerchantName = escapeHtmlAttribute(merchantName);
  const escapedRecipientName = escapeHtmlAttribute(recipientName);
  const escapedDevices = devices.map((device) => escapeHtmlAttribute(device));
  const rawSupport =
    merchant.support_email || merchant.email || 'the store team';
  const supportContact = escapeHtmlAttribute(rawSupport);
  const sanitizedReceiptsUrl = sanitizeUrl(claimUrl || delivery.receiptsUrl);
  const textDevices = devices
    .map((device, index) => `${index + 1}. ${device}`)
    .join('\n');

  return {
    fromName: merchant.email_sender_name || merchant.business_name || 'Orders',
    subject: RECEIPT_CHANGED_SUBJECT,
    htmlContent: renderReceiptEmailHtml({
      preheader: `Your ${escapedMerchantName} receipt is now in your online account.`,
      brandWordmark: escapedMerchantName,
      brandColor,
      eyebrow: 'Receipt',
      headline: 'Your receipt is now in your account',
      subhead:
        'A simpler, more secure way to keep your purchase records in one place.',
      greetingName: escapedRecipientName,
      logoUrl: escapeHtmlAttribute(emailSafeLogoUrl(merchant)),
      introHtml: `${escapedMerchantName} has moved your receipt for the following item(s) to your online account.`,
      sectionLabel: 'On this receipt',
      deviceRowsHtml: renderReceiptDeviceRows(escapedDevices, brandColor),
      ctaHtml: renderReceiptCta(
        escapeHtmlAttribute(sanitizedReceiptsUrl),
        'View your receipt',
        brandColor
      ),
      reassurance:
        'This is to ensure you can access your receipt at any time from the website. Nothing about your purchase has changed.',
      supportLineHtml: buildReceiptSupportLine(
        rawSupport,
        supportContact,
        brandColor
      ),
      footerNote: escapedMerchantName,
    }),
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
      `Need help? Contact ${rawSupport}.`,
    ].join('\n'),
  };
}

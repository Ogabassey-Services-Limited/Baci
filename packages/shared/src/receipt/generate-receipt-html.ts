/**
 * Receipt/Invoice HTML Generator (Multi-Tenant)
 *
 * Generates a self-contained HTML document styled for PDF export via expo-print.
 * Dynamically adapts to each merchant's brand: logo, colors, business info.
 * Supports paid receipts, unpaid invoices, and partial payment breakdowns.
 */

import { normalizeReceiptColor } from './receipt-colors';
import { renderReceiptDocument } from './receipt-document';
import { createMoneyFormatter, hexToRgba } from './receipt-money';
import { renderBankDetailsHtml } from './receipt-payment-instructions';
import {
  renderFinancialSummaryLines,
  renderFulfillmentDetailsHtml,
  renderItemRows,
  renderLogoHtml,
  renderPaymentHistoryHtml,
  renderQrHtml,
  renderTermsHtml,
} from './receipt-sections';
import { buildSocialItems } from './receipt-social';
import { getReceiptStatusConfig } from './receipt-status';
import type { ReceiptMerchant, ReceiptOptions, ReceiptOrder } from './types';

function normalizeAddressPart(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized || null;
}

function normalizeCountryForComparison(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'ng' || normalized === 'nga') {
    return 'nigeria';
  }

  return normalized.replace(/\b(?:ng|nga)\b/g, 'nigeria');
}

function formatCountryForReceipt(value: string) {
  const normalized = value.trim();
  return normalizeCountryForComparison(normalized) === 'nigeria'
    ? 'Nigeria'
    : normalized;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasCountryToken(part: string, country: string) {
  return new RegExp(`(?:^|\\W)${escapeRegExp(country)}(?:\\W|$)`).test(part);
}

function hasAddressPart(parts: string[], value: string, isCountry = false) {
  const normalizedValue = isCountry
    ? normalizeCountryForComparison(value)
    : value.toLowerCase();

  return parts.some((part) => {
    const normalizedPart = isCountry
      ? normalizeCountryForComparison(part)
      : part.toLowerCase();
    return (
      normalizedPart === normalizedValue ||
      (isCountry && hasCountryToken(normalizedPart, normalizedValue))
    );
  });
}

function appendAddressPart(
  parts: string[],
  value: string | null | undefined,
  options: { isCountry?: boolean } = {}
) {
  const normalized = normalizeAddressPart(value);
  const displayValue = options.isCountry
    ? normalized && formatCountryForReceipt(normalized)
    : normalized;
  if (!displayValue || hasAddressPart(parts, displayValue, options.isCountry)) {
    return;
  }

  parts.push(displayValue);
}

export function generateReceiptHtml(
  order: ReceiptOrder,
  merchant: ReceiptMerchant,
  options: ReceiptOptions = {}
): string {
  const brandPrimary = normalizeReceiptColor(merchant.brand_colors?.primary);
  const brandAccent = normalizeReceiptColor(
    merchant.brand_colors?.accent,
    brandPrimary
  );
  const brandLight = hexToRgba(brandPrimary, 0.06);
  const brandCardBorder = hexToRgba(brandPrimary, 0.12);

  const isPaid = order.payment_status === 'paid';
  const statusConfig = getReceiptStatusConfig(order.payment_status);
  const docTitle = isPaid ? 'Receipt' : 'Invoice';

  const currencyCode = order.currency || 'NGN';
  const formatMoney = createMoneyFormatter(currencyCode);

  const orderDate = new Date(order.created_at);
  const dateStr = orderDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = orderDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const storeName =
    merchant.legal_entity_name || merchant.business_name || 'Store';
  // Only the public support email belongs on a customer-facing receipt — never
  // fall back to `merchant.email`, which is the merchant's private login address.
  const contactEmail = merchant.support_email || null;
  const contactPhone = merchant.support_phone || merchant.phone;

  const addr = order.shipping_address;
  const addressParts: string[] = [];
  appendAddressPart(addressParts, addr?.address_line1);
  appendAddressPart(addressParts, addr?.address_line2);
  appendAddressPart(
    addressParts,
    [addr?.city, addr?.state].filter(Boolean).join(', ')
  );
  appendAddressPart(addressParts, addr?.postal_code);
  appendAddressPart(addressParts, addr?.country, { isCountry: true });

  return renderReceiptDocument({
    order,
    merchant,
    addressParts,
    bankDetailsHtml: renderBankDetailsHtml({
      order,
      merchant,
      options,
      brandPrimary,
      brandAccent,
      contactEmail,
      contactPhone,
      isPaid,
    }),
    brandCardBorder,
    brandLight,
    brandPrimary,
    contactEmail,
    contactPhone,
    dateStr,
    docTitle,
    fulfillmentDetailsHtml: renderFulfillmentDetailsHtml(order),
    isPaid,
    itemRows: renderItemRows(order, formatMoney),
    logoHtml: renderLogoHtml(merchant, storeName, options.svgXml),
    paymentHistoryHtml: renderPaymentHistoryHtml(order, formatMoney),
    qrHtml: renderQrHtml(options, isPaid),
    socialItems: buildSocialItems(merchant.social_media),
    statusConfig,
    summaryLines: renderFinancialSummaryLines(
      order,
      merchant,
      formatMoney,
      statusConfig.color,
      isPaid
    ),
    termsHtml: renderTermsHtml(merchant, options),
    timeStr,
  });
}

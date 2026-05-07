/**
 * Receipt/Invoice HTML Generator (Multi-Tenant)
 *
 * Generates a self-contained HTML document styled for PDF export via expo-print.
 * Dynamically adapts to each merchant's brand: logo, colors, business info.
 * Supports paid receipts, unpaid invoices, and partial payment breakdowns.
 */

import { escapeHtml } from './escape-html';
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

  const rawStoreName =
    merchant.legal_entity_name || merchant.business_name || merchant.email;
  const storeName = escapeHtml(rawStoreName);
  const contactEmail = merchant.support_email || merchant.email;
  const contactPhone = merchant.support_phone || merchant.phone;

  const addr = order.shipping_address;
  const addressParts = [
    addr?.address_line1,
    addr?.address_line2,
    [addr?.city, addr?.state].filter(Boolean).join(', '),
  ].filter((part): part is string => Boolean(part));

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

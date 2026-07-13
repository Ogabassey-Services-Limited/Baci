import 'server-only';

import { escapeHtmlAttribute, escapeHtmlText } from '@/lib/sanitize';
import { sanitizeText, sanitizeUrl } from '@/lib/sanitize-core';

const NGN_FORMATTER = new Intl.NumberFormat('en-NG', {
  currency: 'NGN',
  maximumFractionDigits: 0,
  style: 'currency',
});

function notificationText(value: string, fallback: string) {
  return sanitizeText(value, 200).replace(/\s+/g, ' ') || fallback;
}

function formatAmount(amount: number | null, currency: 'NGN' | 'USDT' | null) {
  if (amount === null || !currency) return null;
  return currency === 'NGN'
    ? NGN_FORMATTER.format(amount)
    : `${amount.toFixed(2)} USDT`;
}

export function buildPetrockRemediationNotification({
  amount,
  carrier,
  currency,
  customerName,
  merchantName,
  status,
  storefrontUrl,
}: {
  amount: number | null;
  carrier: string | null;
  currency: 'NGN' | 'USDT' | null;
  customerName: string;
  merchantName: string;
  status: 'cancelled' | 'completed' | 'failed' | 'refunded';
  storefrontUrl: string;
}) {
  const safeStorefrontUrl = sanitizeUrl(storefrontUrl);
  if (!safeStorefrontUrl) throw new Error('Invalid storefront URL');

  const title =
    status === 'completed'
      ? 'Carrier unlock complete'
      : status === 'refunded'
        ? 'Carrier unlock refunded'
        : status === 'cancelled'
          ? 'Carrier unlock cancelled'
          : 'Carrier unlock update';
  const carrierLabel = notificationText(carrier ?? '', 'your carrier');
  const body =
    status === 'completed'
      ? `Your ${carrierLabel} unlock is complete. Open Unlock orders for details.`
      : status === 'refunded'
        ? `Your ${carrierLabel} unlock could not be completed. Your wallet has been refunded.`
        : status === 'cancelled'
          ? `Your ${carrierLabel} unlock order was cancelled.`
          : `Your ${carrierLabel} unlock could not be completed. Open Unlock orders for details.`;
  const trackingUrl = new URL('/unlock-orders', safeStorefrontUrl).toString();
  const formattedAmount = formatAmount(amount, currency);
  const amountLine = formattedAmount
    ? `\nOrder amount: ${formattedAmount}`
    : '';
  const textContent = [
    `Hi ${notificationText(customerName, 'Customer')},`,
    '',
    body,
    amountLine.trim(),
    '',
    `Track this order: ${trackingUrl}`,
    '',
    notificationText(merchantName, 'Baci Merchant'),
  ]
    .filter((line, index, lines) => line || lines[index - 1] !== '')
    .join('\n');
  const safeName = escapeHtmlText(customerName);
  const safeBody = escapeHtmlText(body);
  const safeAmount = formattedAmount
    ? `<p><strong>Order amount:</strong> ${escapeHtmlText(formattedAmount)}</p>`
    : '';
  const htmlContent = `<p>Hi ${safeName},</p><p>${safeBody}</p>${safeAmount}<p><a href="${escapeHtmlAttribute(trackingUrl)}">View Unlock orders</a></p><p>${escapeHtmlText(merchantName)}</p>`;

  return {
    body,
    htmlContent,
    subject: `${title} - ${notificationText(merchantName, 'Baci Merchant')}`,
    textContent,
    title,
    trackingUrl,
  };
}

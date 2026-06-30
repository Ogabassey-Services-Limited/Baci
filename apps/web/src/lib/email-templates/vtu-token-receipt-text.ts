import { stripHtmlTags } from '@/lib/sanitize-core';
import { formatEmailMoney } from './shared';
import type { VtuTokenReceiptData } from './vtu-token-receipt';

// NOTE: Each email's HTML and plain-text generators are intentionally
// co-located in a single module (one cohesive template, two renderings).
// The VTU token receipt is the sole exception: its combined module exceeds
// the 300-line limit, so the text generator lives here while the HTML
// generator and the shared `VtuTokenReceiptData` type stay in
// `vtu-token-receipt.ts`.
export function generateVtuTokenReceiptText(data: VtuTokenReceiptData): string {
  const isTokenReady = Boolean(data.voucherPin);
  const expectsToken =
    data.type === 'electricity' ||
    data.type === 'cable_tv' ||
    data.type === 'betting';
  const isTokenPending = expectsToken && !isTokenReady;
  const typeLabel =
    data.type === 'electricity'
      ? 'Electricity Token'
      : data.type === 'cable_tv'
        ? 'TV Decoder Subscription'
        : data.type === 'betting'
          ? 'Gaming Account Top-up'
          : data.type === 'airtime'
            ? 'Airtime Top-up'
            : 'Data Top-up';

  const voucherPin = data.voucherPin ? stripHtmlTags(data.voucherPin) : null;
  const tokenLine =
    isTokenReady && voucherPin
      ? `YOUR PREPAID TOKEN PIN: ${voucherPin}\n(Enter this token directly into your meter or decoder to activate.)\n`
      : expectsToken
        ? 'Status: Payment received. Token fulfillment is still in progress and will be updated once available.\n'
        : `Status: Successful (Directly credited to your account. No PIN entry required.)\n`;

  const customerIdLabel =
    data.type === 'electricity'
      ? 'Meter Number'
      : data.type === 'cable_tv'
        ? 'Smartcard / Decoder Number'
        : 'Target Account';
  const customerName = stripHtmlTags(data.customerName);
  const merchantName = stripHtmlTags(data.merchantName);
  const providerLabel = stripHtmlTags(data.providerLabel);
  const customerIdentifier = data.customerIdentifier
    ? stripHtmlTags(data.customerIdentifier)
    : null;
  const address = data.address ? stripHtmlTags(data.address) : null;
  const contactPhone = data.phone_number
    ? stripHtmlTags(data.phone_number)
    : null;
  const reference = stripHtmlTags(data.reference);
  const heading = isTokenPending
    ? `${typeLabel} Payment Received`
    : `${typeLabel} Confirmation!`;
  const introText = isTokenPending
    ? `Thank you for your purchase from ${merchantName}. Your payment was successful and we're still retrieving the service token.`
    : `Thank you for your purchase from ${merchantName}. Your payment has been verified and fulfilled.`;

  return `
${heading}

Hi ${customerName},

${introText}

${tokenLine}
TRANSACTION DETAILS:
- Biller/Service: ${providerLabel}
- Product: ${typeLabel}
${customerIdentifier ? `- ${customerIdLabel}: ${customerIdentifier}\n` : ''}${address ? `- Address: ${address}\n` : ''}${contactPhone ? `- Contact Phone: ${contactPhone}\n` : ''}- Total Amount: ${formatEmailMoney(data.amount, data.currency)}
- Reference Number: ${reference}

If you have any questions, please contact ${merchantName} directly.

---
Powered by Baci — AI E-commerce Platform
  `.trim();
}

import { escapeHtmlAttribute, escapeHtmlText } from '@/lib/sanitize';
import { sanitizeUrl } from '@/lib/sanitize-core';
import type { MerchantRegistrationInfo } from './shared';
import { buildEscapedRegistrationLine } from './shared';

interface OrderDeliveredData extends MerchantRegistrationInfo {
  orderNumber: string;
  customerName: string;
  items: { name: string; quantity: number }[];
  merchantName: string;
  merchantUrl: string;
  supportEmail?: string;
  googlePlaceId?: string | null;
}

/**
 * Generate Order Delivered email HTML - Premium 2025 Design with Google Rating CTA
 */

export function generateOrderDeliveredEmail(data: OrderDeliveredData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px 16px; border-bottom: 1px solid #f0f0f0; color: #1e293b; font-size: 14px;">
        ✓ ${escapeHtmlText(item.name)}
      </td>
      <td style="padding: 8px 16px; border-bottom: 1px solid #f0f0f0; text-align: center; color: #64748b; font-size: 14px;">
        x${item.quantity}
      </td>
    </tr>
  `
    )
    .join('');

  // Google Places review URL - opens write review modal
  const googleReviewUrl = data.googlePlaceId
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(data.googlePlaceId)}`
    : null;

  const ratingCTA = googleReviewUrl
    ? `
    <!-- Google Rating CTA -->
    <div style="background: linear-gradient(135deg, #fef9c3 0%, #fef08a 100%); border-radius: 16px; padding: 24px; margin: 24px 0; border: 2px solid #facc15; text-align: center;">
      <div style="font-size: 36px; margin-bottom: 12px;">⭐</div>
      <h3 style="margin: 0 0 8px 0; font-size: 20px; color: #713f12; font-weight: 700;">Loved Your Experience?</h3>
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #92400e;">
        Your feedback helps us grow! Leave a quick Google review.
      </p>
      <a href="${escapeHtmlAttribute(googleReviewUrl)}" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);">
        ⭐ Rate Us on Google
      </a>
    </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Order Has Been Delivered!</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f1f5f9; -webkit-font-smoothing: antialiased;">

  <div style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">

    <!-- Header - Celebration Theme -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
      <div style="font-size: 56px; margin-bottom: 16px;">🎉</div>
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Order Delivered!</h1>
      <p style="margin: 12px 0 0 0; color: #d1fae5; font-size: 16px;">Order #${escapeHtmlText(data.orderNumber)}</p>
    </div>

    <!-- Body -->
    <div style="padding: 30px;">
      <p style="margin: 0; font-size: 16px; color: #334155; line-height: 1.6;">
        Hi <strong>${escapeHtmlText(data.customerName)}</strong>,
      </p>
      <p style="margin: 16px 0 0 0; font-size: 16px; color: #475569; line-height: 1.6;">
        Great news! Your order has been successfully delivered. We hope you love your purchase!
      </p>

      <!-- Items Delivered -->
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <div style="font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
          📦 Items Delivered
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${itemsHtml}
        </table>
      </div>

      ${ratingCTA}

      <!-- Support Note -->
      <div style="background: #f0f9ff; border-radius: 12px; padding: 20px; margin-top: 24px; border: 1px solid #bae6fd;">
        <p style="margin: 0; font-size: 14px; color: #0369a1; line-height: 1.6;">
          <strong>Need Help?</strong><br>
          If you have any issues with your order, please don't hesitate to reach out. We're here to help!
        </p>
      </div>
    </div>

    <!-- CTA -->
    <div style="padding: 0 30px 30px 30px; text-align: center;">
      <a href="${escapeHtmlAttribute(sanitizeUrl(data.merchantUrl))}" style="background: #10b981; color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);">
        Shop Again at ${escapeHtmlText(data.merchantName)}
      </a>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
        Thank you for shopping with <strong>${escapeHtmlText(data.merchantName)}</strong>
      </p>
      ${data.supportEmail ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af;">Questions? Contact us at ${escapeHtmlText(data.supportEmail)}</p>` : ''}
      ${(() => {
        const reg = buildEscapedRegistrationLine(data);
        return reg
          ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #9ca3af;">${reg}</p>`
          : '';
      })()}
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        Powered by <strong>Baci</strong> — AI E-commerce Platform
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of order delivered email
 */

export function generateOrderDeliveredText(data: OrderDeliveredData): string {
  const itemsList = data.items
    .map((item) => `✓ ${item.name} x${item.quantity}`)
    .join('\n');

  // Extract conditional strings for cleaner template (2026 best practice)
  const googleReviewUrl = data.googlePlaceId
    ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(data.googlePlaceId)}`
    : null;

  const reviewSection = googleReviewUrl
    ? `
⭐ RATE YOUR EXPERIENCE
Loved your experience? Leave us a Google review:
${googleReviewUrl}
`
    : '';

  const contactLine = data.supportEmail
    ? `Need help? Contact us at ${data.supportEmail}.`
    : 'Need help? Contact us.';

  return `
🎉 Your Order Has Been Delivered!

Hi ${data.customerName},

Great news! Your order #${data.orderNumber} has been successfully delivered. We hope you love your purchase!

ITEMS DELIVERED
${itemsList}

${reviewSection}

${contactLine}

Shop again at ${data.merchantUrl}

Thank you for shopping with ${data.merchantName}!

---
Powered by Baci - AI E-commerce Platform
  `.trim();
}

// --- Order Cancellation Email ---

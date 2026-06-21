import { escapeHtmlAttribute, escapeHtmlText } from '@/lib/sanitize';
import { sanitizeUrl } from '@/lib/sanitize-core';
import type { MerchantRegistrationInfo } from './shared';
import { buildEscapedRegistrationLine, getSafeHttpUrl } from './shared';

interface OrderShippedData extends MerchantRegistrationInfo {
  orderNumber: string;
  customerName: string;
  items: { name: string; quantity: number }[];
  shippingAddress: {
    address: string;
    city: string;
    state: string;
    phone: string;
  };
  trackingNumber?: string;
  trackingUrl?: string;
  courierName?: string;
  estimatedDelivery?: string;
  merchantName: string;
  merchantUrl: string;
  supportEmail?: string;
}

/**
 * Generate Order Shipped email HTML - Premium 2025 Design
 */

export function generateOrderShippedEmail(data: OrderShippedData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; color: #1e293b; font-size: 14px;">
        ${escapeHtmlText(item.name)}
      </td>
      <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; text-align: center; color: #64748b; font-size: 14px;">
        x${item.quantity}
      </td>
    </tr>
  `
    )
    .join('');

  // Extract conditional strings for cleaner template (2026 best practice)
  const courierRow = data.courierName
    ? `
        <tr>
          <td style="padding: 6px 0; color: #6b7280;">Courier</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600; text-align: right;">${escapeHtmlText(data.courierName)}</td>
        </tr>
        `
    : '';

  const estimatedDeliveryRow = data.estimatedDelivery
    ? `
        <tr>
          <td style="padding: 6px 0; color: #6b7280;">Est. Delivery</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600; text-align: right;">${escapeHtmlText(data.estimatedDelivery)}</td>
        </tr>
        `
    : '';

  const safeTrackingUrl = getSafeHttpUrl(data.trackingUrl);
  const escapedTrackingUrl = safeTrackingUrl
    ? escapeHtmlAttribute(safeTrackingUrl)
    : undefined;

  const trackingLinkHtml = escapedTrackingUrl
    ? `
      <div style="margin-top: 16px; text-align: center;">
        <a href="${escapedTrackingUrl}" style="background: #059669; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block;">
          Track Package
        </a>
      </div>
      <div style="font-size: 11px; color: #6b7280; text-align: center; margin-top: 8px; word-break: break-all;">
        ${escapedTrackingUrl}
      </div>
      `
    : '';

  const trackingHtml = data.trackingNumber
    ? `
    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #a7f3d0;">
      <div style="font-size: 14px; font-weight: 600; color: #065f46; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
        📦 Tracking Information
      </div>
      <table style="width: 100%; font-size: 14px;">
        ${courierRow}
        <tr>
          <td style="padding: 6px 0; color: #6b7280;">Tracking Number</td>
          <td style="padding: 6px 0; color: #059669; font-weight: 700; text-align: right; font-family: monospace;">${escapeHtmlText(data.trackingNumber)}</td>
        </tr>
        ${estimatedDeliveryRow}
      </table>
      ${trackingLinkHtml}
    </div>
    `
    : '';

  let whatsNextMessage =
    'Our delivery team will contact you before arrival. Please keep your phone available.';
  if (data.trackingNumber && safeTrackingUrl) {
    whatsNextMessage =
      "You can track your package using the tracking number and link above. We'll deliver it as soon as possible!";
  } else if (data.trackingNumber) {
    whatsNextMessage =
      "You can track your package using the tracking number above. We'll deliver it as soon as possible!";
  }

  const supportEmailHtml = data.supportEmail
    ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af;">Questions? Contact us at ${escapeHtmlText(data.supportEmail)}</p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Order Has Shipped!</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f1f5f9; -webkit-font-smoothing: antialiased;">

  <div style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">

    <!-- Header - Green/Success Theme -->
    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px 30px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">🚚</div>
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Your Order is On Its Way!</h1>
      <p style="margin: 12px 0 0 0; color: #d1fae5; font-size: 16px;">Order #${escapeHtmlText(data.orderNumber)}</p>
    </div>

    <!-- Body -->
    <div style="padding: 30px;">
      <p style="margin: 0; font-size: 16px; color: #334155; line-height: 1.6;">
        Hi <strong>${escapeHtmlText(data.customerName)}</strong>,
      </p>
      <p style="margin: 16px 0 0 0; font-size: 16px; color: #475569; line-height: 1.6;">
        Great news! Your order has been shipped and is on its way to you. Here's the delivery information:
      </p>

      ${trackingHtml}

      <!-- Delivery Address -->
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <div style="font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
          📍 Delivery Address
        </div>
        <p style="margin: 0; font-size: 15px; color: #1e293b; line-height: 1.6;">
          <strong>${escapeHtmlText(data.customerName)}</strong><br>
          ${escapeHtmlText(data.shippingAddress.address)}<br>
          ${escapeHtmlText(data.shippingAddress.city)}, ${escapeHtmlText(data.shippingAddress.state)}<br>
          Phone: ${escapeHtmlText(data.shippingAddress.phone)}
        </p>
      </div>

      <!-- Items Summary -->
      <div style="margin: 24px 0;">
        <div style="font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
          📦 Items in This Shipment
        </div>
        <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 8px; overflow: hidden;">
          ${itemsHtml}
        </table>
      </div>

      <!-- What's Next -->
      <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-radius: 12px; padding: 20px; margin-top: 24px; border: 1px solid #fde68a;">
        <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.6;">
          <strong>What's Next?</strong><br>
          ${whatsNextMessage}
        </p>
      </div>
    </div>

    <!-- CTA -->
    <div style="padding: 0 30px 30px 30px; text-align: center;">
      <a href="${escapeHtmlAttribute(sanitizeUrl(data.merchantUrl))}" style="background: #059669; color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3);">
        Visit ${escapeHtmlText(data.merchantName)}
      </a>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
        Thank you for shopping with <strong>${escapeHtmlText(data.merchantName)}</strong>
      </p>
      ${supportEmailHtml}
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
 * Generate plain text version of order shipped email
 */

export function generateOrderShippedText(data: OrderShippedData): string {
  const itemsList = data.items
    .map((item) => `- ${item.name} x${item.quantity}`)
    .join('\n');

  // Extract conditional strings for cleaner template (2026 best practice)
  const courierLine = data.courierName ? `Courier: ${data.courierName}\n` : '';
  const estimatedDeliveryLine = data.estimatedDelivery
    ? `Estimated Delivery: ${data.estimatedDelivery}\n`
    : '';
  const safeTrackingUrl = getSafeHttpUrl(data.trackingUrl);
  const trackingLinkLine = safeTrackingUrl
    ? `Tracking Link: ${safeTrackingUrl}\n`
    : '';

  const trackingSection = data.trackingNumber
    ? `TRACKING INFORMATION
${courierLine}Tracking Number: ${data.trackingNumber}
${trackingLinkLine}
${estimatedDeliveryLine}`
    : '';

  let trackingNote =
    'Our delivery team will contact you before arrival. Please keep your phone available.';
  if (data.trackingNumber && safeTrackingUrl) {
    trackingNote =
      'You can track your package using the tracking number and link above.';
  } else if (data.trackingNumber) {
    trackingNote =
      'You can track your package using the tracking number above.';
  }

  const supportLine = data.supportEmail
    ? `Questions? Contact us at ${data.supportEmail}`
    : '';

  return `
🚚 Your Order Has Shipped!

Hi ${data.customerName},

Great news! Your order #${data.orderNumber} has been shipped and is on its way to you.

${trackingSection}

DELIVERY ADDRESS
${data.customerName}
${data.shippingAddress.address}
${data.shippingAddress.city}, ${data.shippingAddress.state}
Phone: ${data.shippingAddress.phone}

ITEMS IN THIS SHIPMENT
${itemsList}

${trackingNote}

Thank you for shopping with ${data.merchantName}!
${supportLine}

---
Powered by Baci - AI E-commerce Platform
  `.trim();
}

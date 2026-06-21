import { escapeHtmlAttribute, escapeHtmlText } from '@/lib/sanitize';
import { sanitizeUrl } from '@/lib/sanitize-core';
import type { MerchantRegistrationInfo, PaymentReminderItem } from './shared';
import { buildEscapedRegistrationLine, formatEmailMoney } from './shared';

interface PaymentReminderData extends MerchantRegistrationInfo {
  orderNumber: string;
  customerName: string;
  items: PaymentReminderItem[];
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentLink: string;
  merchantName: string;
  merchantUrl: string;
  currency?: string;
  supportEmail?: string;
  virtualAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null;
}

/**
 * Generate a beautiful 2025-style payment reminder email HTML
 */

export function generatePaymentReminderEmail(
  data: PaymentReminderData
): string {
  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0;">
        <span style="color: #1a1a2e; font-weight: 500;">${escapeHtmlText(item.name)}</span>
        <span style="color: #6b7280; font-size: 13px;"> × ${item.quantity}</span>
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #1a1a2e; font-weight: 600;">
        ${formatEmailMoney(item.price * item.quantity, data.currency)}
      </td>
    </tr>
  `
    )
    .join('');

  const bankTransferHtml = data.virtualAccount
    ? `
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; padding: 20px; margin-top: 24px; border: 1px solid #e2e8f0;">
      <div style="font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
        💳 Bank Transfer Option
      </div>
      <div style="background: #fff; border-radius: 8px; padding: 16px;">
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="color: #6b7280; padding: 4px 0;">Bank:</td>
            <td style="color: #1a1a2e; font-weight: 600; text-align: right;">${escapeHtmlText(data.virtualAccount.bankName)}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 4px 0;">Account Number:</td>
            <td style="color: #1a1a2e; font-weight: 700; text-align: right; font-size: 16px;">${escapeHtmlText(data.virtualAccount.accountNumber)}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 4px 0;">Account Name:</td>
            <td style="color: #1a1a2e; font-weight: 600; text-align: right;">${escapeHtmlText(data.virtualAccount.accountName)}</td>
          </tr>
        </table>
      </div>
    </div>
  `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Reminder - Order #${escapeHtmlText(data.orderNumber)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f8; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

    <!-- Header with Gradient -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
        Payment Reminder
      </h1>
      <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 15px;">
        Complete your order at ${escapeHtmlText(data.merchantName)}
      </p>
    </div>

    <!-- Main Content -->
    <div style="padding: 32px 30px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        Hi <strong>${escapeHtmlText(data.customerName)}</strong>,
      </p>

      <p style="color: #6b7280; font-size: 15px; margin: 0 0 24px 0;">
        We noticed your order <strong>#${escapeHtmlText(data.orderNumber)}</strong> is awaiting payment.
        Don't miss out on your items—complete your purchase with just one click!
      </p>

      <!-- Order Summary Card -->
      <div style="background: #fafafa; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background: #1a1a2e; padding: 14px 16px;">
          <span style="color: #fff; font-weight: 600; font-size: 14px;">Order #${escapeHtmlText(data.orderNumber)}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${itemsHtml}
        </table>
        <div style="padding: 16px; border-top: 2px solid #e5e7eb;">
          <table style="width: 100%;">
            <tr>
              <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Order Total:</td>
              <td style="color: #1a1a2e; font-size: 14px; text-align: right;">${formatEmailMoney(data.totalAmount, data.currency)}</td>
            </tr>
            ${
              data.amountPaid > 0
                ? `
            <tr>
              <td style="color: #10b981; font-size: 14px; padding: 4px 0;">Amount Paid:</td>
              <td style="color: #10b981; font-size: 14px; text-align: right;">-${formatEmailMoney(data.amountPaid, data.currency)}</td>
            </tr>
            `
                : ''
            }
            <tr>
              <td style="color: #1a1a2e; font-size: 18px; font-weight: 700; padding: 12px 0 0 0;">Balance Due:</td>
              <td style="color: #dc2626; font-size: 20px; font-weight: 800; text-align: right; padding: 12px 0 0 0;">${formatEmailMoney(data.balanceDue, data.currency)}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${escapeHtmlAttribute(sanitizeUrl(data.paymentLink))}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 50px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);">
          Complete Payment →
        </a>
      </div>

      <!-- Bank Transfer Option -->
      ${bankTransferHtml}

      <!-- Footer Note -->
      <div style="margin-top: 32px; padding: 20px; background: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; font-size: 14px; color: #92400e;">
          <strong>Need help?</strong><br>
          Reply to this email or contact us at <a href="mailto:${escapeHtmlAttribute(data.supportEmail || `support@${data.merchantUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}`)}" style="color: #764ba2;">${escapeHtmlText(data.supportEmail || data.merchantName)}</a>
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
        Thank you for shopping with <strong>${escapeHtmlText(data.merchantName)}</strong>
      </p>
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
 * Generate plain text version of payment reminder
 */

export function generatePaymentReminderText(data: PaymentReminderData): string {
  const itemsText = data.items
    .map(
      (item) =>
        `• ${item.name} × ${item.quantity} — ${formatEmailMoney(item.price * item.quantity, data.currency)}`
    )
    .join('\n');

  const bankDetails = data.virtualAccount
    ? `\n\nBank Transfer Option:\nBank: ${data.virtualAccount.bankName}\nAccount Number: ${data.virtualAccount.accountNumber}\nAccount Name: ${data.virtualAccount.accountName}`
    : '';

  return `
Payment Reminder — Order #${data.orderNumber}

Hi ${data.customerName},

We noticed your order is awaiting payment. Don't miss out on your items!

Order Details:
${itemsText}

Order Total: ${formatEmailMoney(data.totalAmount, data.currency)}
${data.amountPaid > 0 ? `Amount Paid: ${formatEmailMoney(data.amountPaid, data.currency)}\n` : ''}Balance Due: ${formatEmailMoney(data.balanceDue, data.currency)}

Complete your payment here: ${data.paymentLink}
${bankDetails}

Thank you for shopping with ${data.merchantName}!

---
Powered by Baci — AI E-commerce Platform
  `.trim();
}

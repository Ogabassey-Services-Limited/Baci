import { escapeHtmlText } from '@/lib/sanitize';
import type { MerchantRegistrationInfo, PaymentReminderItem } from './shared';
import { buildEscapedRegistrationLine, formatEmailMoney } from './shared';

interface PaymentReceiptData extends MerchantRegistrationInfo {
  orderNumber: string;
  customerName: string;
  items: PaymentReminderItem[];
  totalAmount: number;
  amountPaidNow: number;
  totalPaidSoFar: number;
  balanceDue: number;
  merchantName: string;
  currency?: string;
  supportEmail?: string;
}

/**
 * Generate a payment receipt email HTML
 */

export function generatePaymentReceiptEmail(data: PaymentReceiptData): string {
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

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - Order #${escapeHtmlText(data.orderNumber)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f8; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

    <!-- Header with Green Gradient for Success -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
        Payment Received
      </h1>
      <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 15px;">
        Thank you for your payment to ${escapeHtmlText(data.merchantName)}
      </p>
    </div>

    <!-- Main Content -->
    <div style="padding: 32px 30px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        Hi <strong>${escapeHtmlText(data.customerName)}</strong>,
      </p>

      <p style="color: #6b7280; font-size: 15px; margin: 0 0 24px 0;">
        We have successfully received a payment of <strong>${formatEmailMoney(data.amountPaidNow, data.currency)}</strong> for your order <strong>#${escapeHtmlText(data.orderNumber)}</strong>.
      </p>

      <!-- Payment Summary Card -->
      <div style="background: #fafafa; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background: #1a1a2e; padding: 14px 16px;">
          <span style="color: #fff; font-weight: 600; font-size: 14px;">Order Status: ${data.balanceDue <= 0 ? 'Fully Paid' : 'Partially Paid'}</span>
        </div>

        <div style="padding: 20px;">
          <table style="width: 100%;">
            <tr>
              <td style="color: #6b7280; font-size: 14px; padding: 6px 0;">Order Total:</td>
              <td style="color: #1a1a2e; font-size: 14px; text-align: right; font-weight: 600;">${formatEmailMoney(data.totalAmount, data.currency)}</td>
            </tr>
             <tr>
              <td style="color: #6b7280; font-size: 14px; padding: 6px 0;">Total Paid So Far:</td>
              <td style="color: #10b981; font-size: 14px; text-align: right; font-weight: 600;">${formatEmailMoney(data.totalPaidSoFar, data.currency)}</td>
            </tr>
            <tr>
              <td style="border-top: 1px solid #e5e7eb; padding-top: 12px; color: #1a1a2e; font-size: 16px; font-weight: 700;">Remaining Balance:</td>
              <td style="border-top: 1px solid #e5e7eb; padding-top: 12px; color: #dc2626; font-size: 18px; font-weight: 800; text-align: right;">${formatEmailMoney(data.balanceDue, data.currency)}</td>
            </tr>
          </table>
        </div>
      </div>

       <!-- Items (Collapsed/Brief) -->
       <div style="margin-top: 24px;">
            <p style="font-size: 13px; color: #9ca3af; text-transform: uppercase; font-weight: 600; margin-bottom: 8px;">Items in this order</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                ${itemsHtml}
            </table>
       </div>

      <!-- Footer Note -->
      <div style="margin-top: 32px; padding: 20px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #0ea5e9;">
        <p style="margin: 0; font-size: 14px; color: #0c4a6e;">
          <strong>Next Steps:</strong><br>
          ${
            data.balanceDue > 0
              ? 'Please complete the remaining payment to finalize your order.'
              : 'Your order is now fully paid and will be processed for shipping.'
          }
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
 * Generate plain text version of payment receipt
 */

export function generatePaymentReceiptText(data: PaymentReceiptData): string {
  return `
Payment Receipt - Order #${data.orderNumber}

Hi ${data.customerName},

We have received a payment of ${formatEmailMoney(data.amountPaidNow, data.currency)} for your order.

Order Status: ${data.balanceDue <= 0 ? 'Fully Paid' : 'Partially Paid'}

Order Total: ${formatEmailMoney(data.totalAmount, data.currency)}
Total Paid So Far: ${formatEmailMoney(data.totalPaidSoFar, data.currency)}
Remaining Balance: ${formatEmailMoney(data.balanceDue, data.currency)}

${data.balanceDue > 0 ? 'Please complete the remaining payment to finalize your order.' : 'Your order is now fully paid.'}

Thank you,
${data.merchantName}
      `.trim();
}

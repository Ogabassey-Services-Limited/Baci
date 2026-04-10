import { escapeHtml, sanitizeUrl } from '@/lib/sanitize-core';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface MerchantRegistrationInfo {
  merchantTin?: string;
  merchantRcNumber?: string;
}

function getSafeHttpUrl(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return sanitizeUrl(value) || undefined;
}

function buildRegistrationLine(data: MerchantRegistrationInfo): string {
  const parts: string[] = [];
  if (data.merchantRcNumber) parts.push(`RC: ${data.merchantRcNumber}`);
  if (data.merchantTin) parts.push(`TIN: ${data.merchantTin}`);
  return parts.join(' &middot; ');
}

interface OrderConfirmationData extends MerchantRegistrationInfo {
  orderNumber: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  shippingAddress: {
    address: string;
    city: string;
    state: string;
    phone: string;
  };
  merchantName: string;
  merchantUrl: string;
}

/**
 * Generate order confirmation email HTML
 */
/**
 * Generate order confirmation email HTML - Baci Premium Design 2025
 */
export function generateOrderConfirmationEmail(
  data: OrderConfirmationData
): string {
  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0;">
        <div style="font-weight: 600; color: #1e293b; font-size: 14px;">${item.name}</div>
      </td>
      <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 14px;">
        ${item.quantity}
      </td>
      <td style="padding: 16px 0; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #1e293b; font-size: 14px;">
        ₦${item.price.toLocaleString()}
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
  <title>Order Confirmation #${data.orderNumber}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 20px !important; }
      .columns { display: block !important; width: 100% !important; padding-bottom: 20px; }
      .invoice-header { flex-direction: column; text-align: left; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f1f5f9; -webkit-font-smoothing: antialiased;">
  
  <!-- Main Container -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 40px 0;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 40px 40px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <!-- Brand Name / Logo -->
                  <td align="left" style="color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                    ${data.merchantName}
                  </td>
                  <!-- Date -->
                  <td align="right" style="color: #94a3b8; font-size: 14px;">
                    ${new Date().toLocaleDateString('en-GB')}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 30px;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; line-height: 1.2;">Order #${data.orderNumber} Confirmed</h1>
                    <p style="margin: 10px 0 0 0; color: #cbd5e1; font-size: 16px;">Thank you for your purchase</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;">
              <p style="margin: 0; font-size: 16px; color: #334155; line-height: 1.6;">Hi <strong>${data.customerName}</strong>,</p>
              <p style="margin: 16px 0 0 0; font-size: 16px; color: #475569; line-height: 1.6;">
                We've received your order and are getting it ready! Your items are currently <strong>on hold</strong> until we receive payment confirmation (if applicable).
              </p>
            </td>
          </tr>

          <!-- Order Items -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="background-color: #f8fafc; border-radius: 8px; padding: 24px; border: 1px solid #e2e8f0;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <thead>
                    <tr>
                      <th align="left" style="padding-bottom: 12px; font-size: 12px; text-transform: uppercase; color: #94a3b8; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Item</th>
                      <th align="center" style="padding-bottom: 12px; font-size: 12px; text-transform: uppercase; color: #94a3b8; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Qty</th>
                      <th align="right" style="padding-bottom: 12px; font-size: 12px; text-transform: uppercase; color: #94a3b8; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>

                <!-- Totals -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px;">
                  <tr>
                    <td align="right" style="padding-top: 8px; color: #64748b; font-size: 14px;">Subtotal</td>
                    <td align="right" style="padding-top: 8px; width: 120px; font-weight: 600; color: #334155; font-size: 14px;">₦${data.subtotal.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td align="right" style="padding-top: 8px; color: #64748b; font-size: 14px;">Shipping</td>
                    <td align="right" style="padding-top: 8px; width: 120px; font-weight: 600; color: #334155; font-size: 14px;">₦${data.shippingFee.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td align="right" style="padding-top: 16px; color: #0f172a; font-size: 16px; font-weight: 700;">Total</td>
                    <td align="right" style="padding-top: 16px; width: 120px; color: #ca8a04; font-size: 18px; font-weight: 800;">₦${data.total.toLocaleString()}</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Addresses -->
          <tr>
            <td style="padding: 40px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <!-- Billing -->
                  <td valign="top" class="columns" width="48%" style="padding-right: 2%;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px;">Billing Info</h3>
                    <p style="margin: 0; font-size: 15px; color: #334155; line-height: 1.5; font-weight: 600;">${data.customerName}</p>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b; line-height: 1.5;">${data.shippingAddress.phone}</p>
                  </td>
                  
                  <!-- Shipping -->
                  <td valign="top" class="columns" width="48%" style="padding-left: 2%;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px;">Shipping Info</h3>
                    <p style="margin: 0; font-size: 15px; color: #334155; line-height: 1.5; font-weight: 600;">${data.customerName}</p>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                      ${data.shippingAddress.address}<br>
                      ${data.shippingAddress.city}, ${data.shippingAddress.state}<br>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding: 0 40px 40px 40px;">
              <a href="${data.merchantUrl}" style="background-color: #0f172a; color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.2);">
                View Order
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #64748b;">
                Questions? Reply to this email or contact us at <a href="${data.merchantUrl}" style="color: #ca8a04; text-decoration: none;">${data.merchantName}</a>
              </p>
              ${(() => {
                const reg = buildRegistrationLine(data);
                return reg
                  ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">${reg}</p>`
                  : '';
              })()}
              <p style="margin: 20px 0 0 0; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} ${data.merchantName}. Powered by <strong>Baci</strong>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of order confirmation
 */
export function generateOrderConfirmationText(
  data: OrderConfirmationData
): string {
  const itemsText = data.items
    .map(
      (item) =>
        `${item.name} x${item.quantity} - ₦${item.price.toLocaleString()}`
    )
    .join('\n');

  return `
Order Confirmed!

Hi ${data.customerName},

Your order has been confirmed and will be shipped soon.

Order Number: #${data.orderNumber}

Items Ordered:
${itemsText}

Subtotal: ₦${data.subtotal.toLocaleString()}
Shipping: ₦${data.shippingFee.toLocaleString()}
Total: ₦${data.total.toLocaleString()}

Shipping Address:
${data.shippingAddress.address}
${data.shippingAddress.city}, ${data.shippingAddress.state}
Phone: ${data.shippingAddress.phone}

What's next?
You'll receive a shipping confirmation email with tracking information once your order is on its way.

Visit Store: ${data.merchantUrl}

If you have any questions about your order, please contact ${data.merchantName} directly.

---
Powered by Baci - AI E-commerce Platform
  `.trim();
}

// --- Payment Reminder Email ---

interface PaymentReminderItem {
  name: string;
  quantity: number;
  price: number;
}

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
        <span style="color: #1a1a2e; font-weight: 500;">${item.name}</span>
        <span style="color: #6b7280; font-size: 13px;"> × ${item.quantity}</span>
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #1a1a2e; font-weight: 600;">
        ₦${(item.price * item.quantity).toLocaleString()}
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
            <td style="color: #1a1a2e; font-weight: 600; text-align: right;">${data.virtualAccount.bankName}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 4px 0;">Account Number:</td>
            <td style="color: #1a1a2e; font-weight: 700; text-align: right; font-size: 16px;">${data.virtualAccount.accountNumber}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 4px 0;">Account Name:</td>
            <td style="color: #1a1a2e; font-weight: 600; text-align: right;">${data.virtualAccount.accountName}</td>
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
  <title>Payment Reminder - Order #${data.orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f8; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header with Gradient -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
        Payment Reminder
      </h1>
      <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 15px;">
        Complete your order at ${data.merchantName}
      </p>
    </div>

    <!-- Main Content -->
    <div style="padding: 32px 30px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        Hi <strong>${data.customerName}</strong>,
      </p>
      
      <p style="color: #6b7280; font-size: 15px; margin: 0 0 24px 0;">
        We noticed your order <strong>#${data.orderNumber}</strong> is awaiting payment. 
        Don't miss out on your items—complete your purchase with just one click!
      </p>

      <!-- Order Summary Card -->
      <div style="background: #fafafa; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background: #1a1a2e; padding: 14px 16px;">
          <span style="color: #fff; font-weight: 600; font-size: 14px;">Order #${data.orderNumber}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${itemsHtml}
        </table>
        <div style="padding: 16px; border-top: 2px solid #e5e7eb;">
          <table style="width: 100%;">
            <tr>
              <td style="color: #6b7280; font-size: 14px; padding: 4px 0;">Order Total:</td>
              <td style="color: #1a1a2e; font-size: 14px; text-align: right;">₦${data.totalAmount.toLocaleString()}</td>
            </tr>
            ${
              data.amountPaid > 0
                ? `
            <tr>
              <td style="color: #10b981; font-size: 14px; padding: 4px 0;">Amount Paid:</td>
              <td style="color: #10b981; font-size: 14px; text-align: right;">-₦${data.amountPaid.toLocaleString()}</td>
            </tr>
            `
                : ''
            }
            <tr>
              <td style="color: #1a1a2e; font-size: 18px; font-weight: 700; padding: 12px 0 0 0;">Balance Due:</td>
              <td style="color: #dc2626; font-size: 20px; font-weight: 800; text-align: right; padding: 12px 0 0 0;">₦${data.balanceDue.toLocaleString()}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${data.paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 50px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);">
          Complete Payment →
        </a>
      </div>

      <!-- Bank Transfer Option -->
      ${bankTransferHtml}

      <!-- Footer Note -->
      <div style="margin-top: 32px; padding: 20px; background: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <p style="margin: 0; font-size: 14px; color: #92400e;">
          <strong>Need help?</strong><br>
          Reply to this email or contact us at <a href="mailto:${data.supportEmail || `support@${data.merchantUrl.replace('https://', '')}`}" style="color: #764ba2;">${data.supportEmail || data.merchantName}</a>
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
        Thank you for shopping with <strong>${data.merchantName}</strong>
      </p>
      ${(() => {
        const reg = buildRegistrationLine(data);
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
        `• ${item.name} × ${item.quantity} — ₦${(item.price * item.quantity).toLocaleString()}`
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

Order Total: ₦${data.totalAmount.toLocaleString()}
${data.amountPaid > 0 ? `Amount Paid: ₦${data.amountPaid.toLocaleString()}\n` : ''}Balance Due: ₦${data.balanceDue.toLocaleString()}

Complete your payment here: ${data.paymentLink}
${bankDetails}

Thank you for shopping with ${data.merchantName}!

---
Powered by Baci — AI E-commerce Platform
  `.trim();
}

// --- Payment Receipt Email (Partial or Full) ---

interface PaymentReceiptData extends MerchantRegistrationInfo {
  orderNumber: string;
  customerName: string;
  items: PaymentReminderItem[];
  totalAmount: number;
  amountPaidNow: number;
  totalPaidSoFar: number;
  balanceDue: number;
  merchantName: string;
  merchantUrl: string;
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
        <span style="color: #1a1a2e; font-weight: 500;">${item.name}</span>
        <span style="color: #6b7280; font-size: 13px;"> × ${item.quantity}</span>
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #1a1a2e; font-weight: 600;">
        ₦${(item.price * item.quantity).toLocaleString()}
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
  <title>Payment Receipt - Order #${data.orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f8; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header with Green Gradient for Success -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
        Payment Received
      </h1>
      <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 15px;">
        Thank you for your payment to ${data.merchantName}
      </p>
    </div>

    <!-- Main Content -->
    <div style="padding: 32px 30px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        Hi <strong>${data.customerName}</strong>,
      </p>
      
      <p style="color: #6b7280; font-size: 15px; margin: 0 0 24px 0;">
        We have successfully received a payment of <strong>₦${data.amountPaidNow.toLocaleString()}</strong> for your order <strong>#${data.orderNumber}</strong>.
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
              <td style="color: #1a1a2e; font-size: 14px; text-align: right; font-weight: 600;">₦${data.totalAmount.toLocaleString()}</td>
            </tr>
             <tr>
              <td style="color: #6b7280; font-size: 14px; padding: 6px 0;">Total Paid So Far:</td>
              <td style="color: #10b981; font-size: 14px; text-align: right; font-weight: 600;">₦${data.totalPaidSoFar.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="border-top: 1px solid #e5e7eb; padding-top: 12px; color: #1a1a2e; font-size: 16px; font-weight: 700;">Remaining Balance:</td>
              <td style="border-top: 1px solid #e5e7eb; padding-top: 12px; color: #dc2626; font-size: 18px; font-weight: 800; text-align: right;">₦${data.balanceDue.toLocaleString()}</td>
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
        Thank you for shopping with <strong>${data.merchantName}</strong>
      </p>
      ${(() => {
        const reg = buildRegistrationLine(data);
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

We have received a payment of ₦${data.amountPaidNow.toLocaleString()} for your order.

Order Status: ${data.balanceDue <= 0 ? 'Fully Paid' : 'Partially Paid'}

Order Total: ₦${data.totalAmount.toLocaleString()}
Total Paid So Far: ₦${data.totalPaidSoFar.toLocaleString()}
Remaining Balance: ₦${data.balanceDue.toLocaleString()}

${data.balanceDue > 0 ? 'Please complete the remaining payment to finalize your order.' : 'Your order is now fully paid.'}

Thank you,
${data.merchantName}
      `.trim();
}

// --- Order Shipped Email ---

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
        ${item.name}
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
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600; text-align: right;">${data.courierName}</td>
        </tr>
        `
    : '';

  const estimatedDeliveryRow = data.estimatedDelivery
    ? `
        <tr>
          <td style="padding: 6px 0; color: #6b7280;">Est. Delivery</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600; text-align: right;">${data.estimatedDelivery}</td>
        </tr>
        `
    : '';

  const safeTrackingUrl = getSafeHttpUrl(data.trackingUrl);
  const escapedTrackingUrl = safeTrackingUrl
    ? escapeHtml(safeTrackingUrl)
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
          <td style="padding: 6px 0; color: #059669; font-weight: 700; text-align: right; font-family: monospace;">${data.trackingNumber}</td>
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
    ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af;">Questions? Contact us at ${data.supportEmail}</p>`
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
      <p style="margin: 12px 0 0 0; color: #d1fae5; font-size: 16px;">Order #${data.orderNumber}</p>
    </div>

    <!-- Body -->
    <div style="padding: 30px;">
      <p style="margin: 0; font-size: 16px; color: #334155; line-height: 1.6;">
        Hi <strong>${data.customerName}</strong>,
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
          <strong>${data.customerName}</strong><br>
          ${data.shippingAddress.address}<br>
          ${data.shippingAddress.city}, ${data.shippingAddress.state}<br>
          Phone: ${data.shippingAddress.phone}
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
      <a href="${data.merchantUrl}" style="background: #059669; color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.3);">
        Visit ${data.merchantName}
      </a>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
        Thank you for shopping with <strong>${data.merchantName}</strong>
      </p>
      ${supportEmailHtml}
      ${(() => {
        const reg = buildRegistrationLine(data);
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

// --- Order Delivered Email ---

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
        ✓ ${item.name}
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
    ? `https://search.google.com/local/writereview?placeid=${data.googlePlaceId}`
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
      <a href="${googleReviewUrl}" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);">
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
      <p style="margin: 12px 0 0 0; color: #d1fae5; font-size: 16px;">Order #${data.orderNumber}</p>
    </div>

    <!-- Body -->
    <div style="padding: 30px;">
      <p style="margin: 0; font-size: 16px; color: #334155; line-height: 1.6;">
        Hi <strong>${data.customerName}</strong>,
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
      <a href="${data.merchantUrl}" style="background: #10b981; color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);">
        Shop Again at ${data.merchantName}
      </a>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
        Thank you for shopping with <strong>${data.merchantName}</strong>
      </p>
      ${data.supportEmail ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af;">Questions? Contact us at ${data.supportEmail}</p>` : ''}
      ${(() => {
        const reg = buildRegistrationLine(data);
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
    ? `https://search.google.com/local/writereview?placeid=${data.googlePlaceId}`
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

interface OrderCancellationData extends MerchantRegistrationInfo {
  orderNumber: string;
  customerName: string;
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  amountPaid: number;
  refundAmount: number;
  cancellationReason?: string;
  cancelledBy: 'merchant' | 'customer';
  merchantName: string;
  merchantUrl: string;
  supportEmail?: string;
}

/**
 * Generate Order Cancellation email HTML - Premium 2025 Design
 */
export function generateOrderCancellationEmail(
  data: OrderCancellationData
): string {
  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; color: #64748b; font-size: 14px; text-decoration: line-through;">
        ${item.name}
      </td>
      <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; text-align: center; color: #94a3b8; font-size: 14px;">
        x${item.quantity}
      </td>
      <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; text-align: right; color: #94a3b8; font-size: 14px;">
        ₦${item.price.toLocaleString()}
      </td>
    </tr>
  `
    )
    .join('');

  const refundSection =
    data.refundAmount > 0
      ? `
    <!-- Refund Info -->
    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #a7f3d0;">
      <div style="font-size: 14px; font-weight: 600; color: #065f46; margin-bottom: 8px;">💰 Refund Information</div>
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Amount Paid</td>
          <td style="padding: 4px 0; text-align: right; color: #1e293b; font-weight: 600;">₦${data.amountPaid.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280;">Refund Amount</td>
          <td style="padding: 4px 0; text-align: right; color: #059669; font-weight: 700;">₦${data.refundAmount.toLocaleString()}</td>
        </tr>
      </table>
      <p style="margin: 12px 0 0 0; font-size: 13px; color: #047857;">
        Your refund will be processed within 3-5 business days.
      </p>
    </div>
    `
      : '';

  const reasonSection = data.cancellationReason
    ? `
    <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #fecaca;">
      <p style="margin: 0; font-size: 14px; color: #991b1b;">
        <strong>Reason:</strong> ${data.cancellationReason}
      </p>
    </div>
    `
    : '';

  // Extract conditional message for cleaner template (2026 best practice)
  const cancellationMessage =
    data.cancelledBy === 'merchant'
      ? 'We regret to inform you that your order has been cancelled.'
      : 'Your order has been successfully cancelled as requested.';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Cancelled - #${data.orderNumber}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f1f5f9; -webkit-font-smoothing: antialiased;">
  
  <div style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    
    <!-- Header - Muted/Cancelled Theme -->
    <div style="background: linear-gradient(135deg, #64748b 0%, #475569 100%); padding: 40px 30px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Order Cancelled</h1>
      <p style="margin: 12px 0 0 0; color: #cbd5e1; font-size: 16px;">Order #${data.orderNumber}</p>
    </div>

    <!-- Body -->
    <div style="padding: 30px;">
      <p style="margin: 0; font-size: 16px; color: #334155; line-height: 1.6;">
        Hi <strong>${data.customerName}</strong>,
      </p>
      <p style="margin: 16px 0 0 0; font-size: 16px; color: #475569; line-height: 1.6;">
        ${cancellationMessage}
      </p>

      ${reasonSection}

      <!-- Cancelled Items -->
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <div style="font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
          📦 Cancelled Items
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${itemsHtml}
        </table>
        <table style="width: 100%; margin-top: 16px;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Order Total</td>
            <td style="padding: 8px 0; text-align: right; color: #94a3b8; font-size: 14px; text-decoration: line-through;">₦${data.totalAmount.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      ${refundSection}

      <!-- Support Note -->
      <div style="background: #f0f9ff; border-radius: 12px; padding: 20px; margin-top: 24px; border: 1px solid #bae6fd;">
        <p style="margin: 0; font-size: 14px; color: #0369a1; line-height: 1.6;">
          <strong>Questions?</strong><br>
          If you have any questions about this cancellation, please don't hesitate to contact us.
        </p>
      </div>
    </div>

    <!-- CTA -->
    <div style="padding: 0 30px 30px 30px; text-align: center;">
      <a href="${data.merchantUrl}" style="background: #475569; color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
        Continue Shopping
      </a>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
        We're sorry this didn't work out. Hope to see you again soon!
      </p>
      ${data.supportEmail ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af;">Contact: ${data.supportEmail}</p>` : ''}
      ${(() => {
        const reg = buildRegistrationLine(data);
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
 * Generate plain text version of order cancellation email
 */
export function generateOrderCancellationText(
  data: OrderCancellationData
): string {
  const itemsList = data.items
    .map(
      (item) =>
        `- ${item.name} x${item.quantity} - ₦${item.price.toLocaleString()}`
    )
    .join('\n');

  // Extract conditional strings for cleaner template (2026 best practice)
  const cancellationMessage =
    data.cancelledBy === 'merchant'
      ? 'We regret to inform you that your order has been cancelled.'
      : 'Your order has been successfully cancelled as requested.';

  const reasonLine = data.cancellationReason
    ? `Reason: ${data.cancellationReason}`
    : '';

  const refundSection =
    data.refundAmount > 0
      ? `
REFUND INFORMATION
Amount Paid: ₦${data.amountPaid.toLocaleString()}
Refund Amount: ₦${data.refundAmount.toLocaleString()}
Your refund will be processed within 3-5 business days.
`
      : '';

  const contactLine = data.supportEmail
    ? `Questions? Contact us at ${data.supportEmail}.`
    : 'Questions? Contact us.';

  return `
❌ Order Cancelled - #${data.orderNumber}

Hi ${data.customerName},

${cancellationMessage}

${reasonLine}

CANCELLED ITEMS
${itemsList}

Order Total: ₦${data.totalAmount.toLocaleString()} (Cancelled)

${refundSection}

${contactLine}

Continue shopping: ${data.merchantUrl}

We're sorry this didn't work out. Hope to see you again soon!

---
Powered by Baci - AI E-commerce Platform
  `.trim();
}

/**
 * Simple email sending abstraction
 * Wraps the zeptomail client for common email operations
 */

import { sendEmail as zeptoSend } from './zeptomail';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

/**
 * Send a transactional email
 */
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    await zeptoSend({
      to,
      subject,
      htmlContent: html,
      emailType: 'orders',
      replyTo,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmation(
  to: string,
  orderDetails: {
    orderId: string;
    customerName: string;
    total: number;
    items: Array<{ name: string; quantity: number; price: number }>;
    merchantName: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const itemsHtml = orderDetails.items
    .map(
      (item) => `
      <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
        ${item.name} x${item.quantity} - ₦${(item.price * item.quantity).toLocaleString()}
      </li>
    `
    )
    .join('');

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Order Confirmed!</h1>
      <p>Hi ${orderDetails.customerName || 'there'},</p>
      <p>Thank you for your order from ${orderDetails.merchantName}!</p>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Order ID:</strong> ${orderDetails.orderId}</p>
        <p style="margin: 10px 0 0;"><strong>Total:</strong> ₦${orderDetails.total.toLocaleString()}</p>
      </div>

      <h3>Items:</h3>
      <ul style="list-style: none; padding: 0;">
        ${itemsHtml}
      </ul>

      <p style="color: #666; font-size: 14px; margin-top: 30px;">
        If you have any questions, please contact the merchant directly.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Order Confirmed - ${orderDetails.merchantName}`,
    html,
  });
}

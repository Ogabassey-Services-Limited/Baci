interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderConfirmationData {
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
export function generateOrderConfirmationEmail(
  data: OrderConfirmationData
): string {
  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <strong>${item.name}</strong>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
        ${item.quantity}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
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
  <title>Order Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #3F51B5; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">Order Confirmed!</h1>
    <p style="margin: 10px 0 0 0; font-size: 16px;">Thank you for your purchase</p>
  </div>

  <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px;">Hi ${data.customerName},</p>

    <p style="font-size: 16px;">
      Your order has been confirmed and will be shipped soon. We've received your order and our team at
      <strong>${data.merchantName}</strong> is preparing it for delivery.
    </p>

    <div style="background-color: white; padding: 20px; border-radius: 6px; margin: 20px 0;">
      <h2 style="margin-top: 0; color: #3F51B5; font-size: 20px;">Order Details</h2>
      <p style="margin: 5px 0;"><strong>Order Number:</strong> #${data.orderNumber}</p>
    </div>

    <h3 style="color: #3F51B5; font-size: 18px; margin-top: 30px;">Items Ordered</h3>
    <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
          <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div style="background-color: white; padding: 20px; border-radius: 6px; margin-top: 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; text-align: right;">Subtotal:</td>
          <td style="padding: 8px 0; text-align: right; width: 120px;">₦${data.subtotal.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; text-align: right;">Shipping:</td>
          <td style="padding: 8px 0; text-align: right;">₦${data.shippingFee.toLocaleString()}</td>
        </tr>
        <tr style="font-size: 18px; font-weight: bold; border-top: 2px solid #ddd;">
          <td style="padding: 12px 0; text-align: right;">Total:</td>
          <td style="padding: 12px 0; text-align: right; color: #3F51B5;">₦${data.total.toLocaleString()}</td>
        </tr>
      </table>
    </div>

    <h3 style="color: #3F51B5; font-size: 18px; margin-top: 30px;">Shipping Address</h3>
    <div style="background-color: white; padding: 20px; border-radius: 6px;">
      <p style="margin: 5px 0;">${data.shippingAddress.address}</p>
      <p style="margin: 5px 0;">${data.shippingAddress.city}, ${data.shippingAddress.state}</p>
      <p style="margin: 5px 0;"><strong>Phone:</strong> ${data.shippingAddress.phone}</p>
    </div>

    <div style="margin-top: 30px; padding: 20px; background-color: #fff3cd; border-radius: 6px; border-left: 4px solid #ffc107;">
      <p style="margin: 0; font-size: 14px;">
        <strong>What's next?</strong><br>
        You'll receive a shipping confirmation email with tracking information once your order is on its way.
      </p>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${data.merchantUrl}" style="display: inline-block; background-color: #3F51B5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Visit Store
      </a>
    </div>

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 14px;">
      <p>If you have any questions about your order, please contact ${data.merchantName} directly.</p>
      <p style="margin-top: 20px;">
        Powered by <strong>Baci</strong> - AI E-commerce Platform
      </p>
    </div>
  </div>
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

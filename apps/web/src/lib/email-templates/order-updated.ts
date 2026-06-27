import { escapeHtmlAttribute, escapeHtmlText } from '@/lib/sanitize';
import { sanitizeUrl } from '@/lib/sanitize-core';
import type { MerchantRegistrationInfo } from './shared';
import { buildEscapedRegistrationLine, formatEmailMoney } from './shared';

interface OrderUpdatedData extends MerchantRegistrationInfo {
  changedFields: string[];
  customerName: string;
  merchantName: string;
  merchantUrl: string;
  orderNumber: string;
  supportEmail?: string;
  totalAmount: number;
  currency?: string;
}

const CHANGED_FIELD_LABELS: Record<string, string> = {
  branch_id: 'Branch',
  customer_email: 'Customer email',
  customer_id: 'Customer',
  customer_name: 'Customer name',
  customer_phone: 'Customer phone',
  discount_amount: 'Discount',
  gift_wrapping_fee: 'Gift wrapping fee',
  items: 'Items',
  notes: 'Notes',
  shipping_address: 'Shipping address',
  shipping_fee: 'Shipping fee',
  source: 'Order source',
  subtotal: 'Subtotal',
  tax_amount: 'Tax',
  tax_basis: 'Tax basis',
  tax_exclusive_amount: 'Tax exclusive amount',
  tax_inclusive_amount: 'Tax inclusive amount',
  total: 'Total',
};

function toFieldLabel(field: string): string {
  const normalizedField = field.trim();
  if (!normalizedField) {
    return 'Order details';
  }

  return (
    CHANGED_FIELD_LABELS[normalizedField] ??
    normalizedField
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

function getChangedFieldsText(changedFields: string[]): string {
  return changedFields.length > 0
    ? changedFields.map(toFieldLabel).join(', ')
    : 'Order details';
}

export function generateOrderUpdatedEmail(data: OrderUpdatedData): string {
  const merchantUrl = sanitizeUrl(data.merchantUrl);
  const changedFieldsHtml = data.changedFields
    .map(
      (field) => `
        <li style="margin-bottom: 8px; color: #334155; font-size: 15px;">
          ${escapeHtmlText(toFieldLabel(field))}
        </li>
      `
    )
    .join('');

  const supportEmailHtml = data.supportEmail
    ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">Questions? Contact us at ${escapeHtmlText(data.supportEmail)}</p>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Updated - #${escapeHtmlText(data.orderNumber)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f1f5f9;">
  <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
    <div style="background: #0f172a; padding: 32px 28px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 26px;">Your Order Was Updated</h1>
      <p style="margin: 10px 0 0 0; color: #cbd5e1; font-size: 15px;">Order #${escapeHtmlText(data.orderNumber)}</p>
    </div>

    <div style="padding: 28px;">
      <p style="margin: 0; color: #334155; font-size: 16px; line-height: 1.6;">
        Hi <strong>${escapeHtmlText(data.customerName)}</strong>,
      </p>
      <p style="margin: 16px 0 0 0; color: #475569; font-size: 15px; line-height: 1.6;">
        ${escapeHtmlText(data.merchantName)} updated your order. The changed details are listed below.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 24px 0;">
        <div style="font-size: 13px; color: #475569; font-weight: 700; margin-bottom: 12px; text-transform: uppercase;">Changed Details</div>
        <ul style="padding-left: 20px; margin: 0;">
          ${changedFieldsHtml || '<li style="color: #334155; font-size: 15px;">Order details</li>'}
        </ul>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <tr>
          <td style="padding: 10px 0; color: #64748b;">Updated Total</td>
          <td style="padding: 10px 0; color: #0f172a; font-weight: 700; text-align: right;">${formatEmailMoney(data.totalAmount, data.currency)}</td>
        </tr>
      </table>
    </div>

    <div style="padding: 0 28px 28px 28px; text-align: center;">
      ${
        merchantUrl
          ? `<a href="${escapeHtmlAttribute(merchantUrl)}" style="background: #0f172a; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">
        View Store
      </a>`
          : ''
      }
    </div>

    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 28px; text-align: center;">
      ${supportEmailHtml}
      ${(() => {
        const reg = buildEscapedRegistrationLine(data);
        return reg
          ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8;">${reg}</p>`
          : '';
      })()}
      <p style="margin: 0; font-size: 12px; color: #94a3b8;">Powered by <strong>Baci</strong></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function generateOrderUpdatedText(data: OrderUpdatedData): string {
  const merchantUrl = sanitizeUrl(data.merchantUrl);
  const supportLine = data.supportEmail
    ? `Questions? Contact us at ${data.supportEmail}.`
    : 'Questions? Contact us.';

  return `
Order Updated - #${data.orderNumber}

Hi ${data.customerName},

${data.merchantName} updated your order.

Changed: ${getChangedFieldsText(data.changedFields)}
Updated Total: ${formatEmailMoney(data.totalAmount, data.currency)}

${merchantUrl ? `Visit: ${merchantUrl}` : ''}
${supportLine}
  `.trim();
}

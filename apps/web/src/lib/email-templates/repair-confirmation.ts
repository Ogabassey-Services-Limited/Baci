import { escapeHtmlText } from '@/lib/sanitize';
import { formatEmailMoney } from './shared';

export interface RepairConfirmationEmailData {
  ticketNumber: number;
  customerName: string;
  merchantName: string;
  /** Human-readable device summary, e.g. "Smartphone — iPhone 13 Pro Max". */
  deviceLabel: string;
  /** Service type name, present only when the booking is linked to a catalogue quote. */
  repairTypeLabel?: string | null;
  quotedPrice?: number | null;
  isFromPrice?: boolean;
  serviceType: 'dropoff' | 'pickup';
  pickupAddress?: string | null;
  currency?: string;
}

function buildQuoteLine(data: RepairConfirmationEmailData): string {
  if (data.quotedPrice == null || !data.repairTypeLabel) {
    return '';
  }

  const pricePrefix = data.isFromPrice === false ? '' : 'From ';
  return `${pricePrefix}${formatEmailMoney(data.quotedPrice, data.currency)}`;
}

/**
 * Generate the repair booking confirmation email HTML sent to the customer
 * right after a repair ticket is created.
 */
export function generateRepairConfirmationEmail(
  data: RepairConfirmationEmailData
): string {
  const quoteLine = buildQuoteLine(data);
  const serviceMethodLabel =
    data.serviceType === 'pickup' ? 'Pickup' : 'Drop-off';
  const pickupHtml =
    data.serviceType === 'pickup' && data.pickupAddress
      ? `
      <tr>
        <td style="color: #6b7280; padding: 4px 0;">Pickup address:</td>
        <td style="color: #1a1a2e; font-weight: 600; text-align: right;">${escapeHtmlText(data.pickupAddress)}</td>
      </tr>
    `
      : '';
  const repairTypeHtml = data.repairTypeLabel
    ? `
      <tr>
        <td style="color: #6b7280; padding: 4px 0;">Repair type:</td>
        <td style="color: #1a1a2e; font-weight: 600; text-align: right;">${escapeHtmlText(data.repairTypeLabel)}</td>
      </tr>
    `
    : '';
  const priceHtml = quoteLine
    ? `
      <tr>
        <td style="color: #6b7280; padding: 4px 0;">Quoted price:</td>
        <td style="color: #dc2626; font-weight: 700; text-align: right;">${escapeHtmlText(quoteLine)}</td>
      </tr>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Repair Request Received - Ticket #${data.ticketNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f8; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
        Repair Request Received
      </h1>
      <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.85); font-size: 15px;">
        Ticket #${data.ticketNumber} at ${escapeHtmlText(data.merchantName)}
      </p>
    </div>

    <div style="padding: 32px 30px;">
      <p style="color: #374151; font-size: 16px; margin: 0 0 24px 0;">
        Hi <strong>${escapeHtmlText(data.customerName)}</strong>,
      </p>

      <p style="color: #6b7280; font-size: 15px; margin: 0 0 24px 0;">
        We've received your repair request. Keep your ticket number handy — you'll
        need it to check your repair status.
      </p>

      <div style="background: #fafafa; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background: #1a1a2e; padding: 14px 16px;">
          <span style="color: #fff; font-weight: 600; font-size: 14px;">Ticket #${data.ticketNumber}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; padding: 16px;">
          <tr>
            <td style="color: #6b7280; padding: 12px 16px 4px;">Device:</td>
            <td style="color: #1a1a2e; font-weight: 600; text-align: right; padding: 12px 16px 4px;">${escapeHtmlText(data.deviceLabel)}</td>
          </tr>
          ${repairTypeHtml}
          ${priceHtml}
          <tr>
            <td style="color: #6b7280; padding: 4px 16px 12px;">Service method:</td>
            <td style="color: #1a1a2e; font-weight: 600; text-align: right; padding: 4px 16px 12px;">${escapeHtmlText(serviceMethodLabel)}</td>
          </tr>
          ${pickupHtml}
        </table>
      </div>

      <div style="margin-top: 24px; padding: 16px; background: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <p style="margin: 0; font-size: 14px; color: #1e3a8a;">
          ${escapeHtmlText(data.merchantName)} will review your request and reach
          out to confirm next steps.
        </p>
      </div>
    </div>

    <div style="background: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
        Thank you for choosing <strong>${escapeHtmlText(data.merchantName)}</strong>
      </p>
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
 * Generate plain text version of the repair booking confirmation email.
 */
export function generateRepairConfirmationText(
  data: RepairConfirmationEmailData
): string {
  const quoteLine = buildQuoteLine(data);
  const serviceMethodLabel =
    data.serviceType === 'pickup' ? 'Pickup' : 'Drop-off';
  const pickupLine =
    data.serviceType === 'pickup' && data.pickupAddress
      ? `\nPickup address: ${data.pickupAddress}`
      : '';
  const repairTypeLine = data.repairTypeLabel
    ? `\nRepair type: ${data.repairTypeLabel}`
    : '';
  const priceLine = quoteLine ? `\nQuoted price: ${quoteLine}` : '';

  return `
Repair Request Received — Ticket #${data.ticketNumber}

Hi ${data.customerName},

We've received your repair request. Keep your ticket number handy — you'll
need it to check your repair status.

Device: ${data.deviceLabel}${repairTypeLine}${priceLine}
Service method: ${serviceMethodLabel}${pickupLine}

${data.merchantName} will review your request and reach out to confirm next steps.

Thank you for choosing ${data.merchantName}!

---
Powered by Baci — AI E-commerce Platform
  `.trim();
}

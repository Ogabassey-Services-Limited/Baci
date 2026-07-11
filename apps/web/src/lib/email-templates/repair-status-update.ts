import type { RepairStatus } from '@/lib/repairs/repair-status';
import { REPAIR_STATUS_LABELS } from '@/lib/repairs/repair-status';
import { escapeHtmlAttribute, escapeHtmlText } from '@/lib/sanitize';

export interface RepairStatusUpdateEmailData {
  ticketNumber: number;
  customerName: string;
  merchantName: string;
  /** Human-readable device summary, e.g. "Smartphone — iPhone 15". */
  deviceLabel: string;
  status: RepairStatus;
  /** Absolute tracking URL, present only when a courier pickup exists. */
  trackingUrl?: string | null;
}

const STATUS_MESSAGES: Record<RepairStatus, string> = {
  pending: "We've received your repair request and will review it shortly.",
  confirmed: 'Good news — your repair request has been confirmed.',
  in_progress: 'Our technicians are now working on your device.',
  completed: 'Your repair is complete. We will be in touch about collection.',
  cancelled: 'Your repair request has been cancelled.',
  rejected: 'Unfortunately we are unable to proceed with this repair request.',
};

function statusMessage(status: RepairStatus): string {
  return STATUS_MESSAGES[status];
}

/**
 * Generate the repair status-update email HTML sent to the customer when a
 * merchant advances a booking (confirm / in progress / complete / etc.).
 */
export function generateRepairStatusUpdateEmail(
  data: RepairStatusUpdateEmailData
): string {
  const label = REPAIR_STATUS_LABELS[data.status];
  const message = statusMessage(data.status);
  const trackingHtml = data.trackingUrl
    ? `
      <div style="margin-top: 20px; text-align: center;">
        <a href="${escapeHtmlAttribute(data.trackingUrl)}" style="display: inline-block; background: #1a1a2e; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Track courier pickup
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
  <title>Repair Update - Ticket #${data.ticketNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f8; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
        Repair ${escapeHtmlText(label)}
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
        ${escapeHtmlText(message)}
      </p>

      <div style="background: #fafafa; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #6b7280; padding: 12px 16px;">Device:</td>
            <td style="color: #1a1a2e; font-weight: 600; text-align: right; padding: 12px 16px;">${escapeHtmlText(data.deviceLabel)}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; padding: 12px 16px;">Status:</td>
            <td style="color: #1a1a2e; font-weight: 600; text-align: right; padding: 12px 16px;">${escapeHtmlText(label)}</td>
          </tr>
        </table>
      </div>

      ${trackingHtml}
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

/** Plain-text version of the repair status-update email. */
export function generateRepairStatusUpdateText(
  data: RepairStatusUpdateEmailData
): string {
  const label = REPAIR_STATUS_LABELS[data.status];
  const message = statusMessage(data.status);
  const trackingLine = data.trackingUrl
    ? `\nTrack courier pickup: ${data.trackingUrl}`
    : '';

  return `
Repair ${label} — Ticket #${data.ticketNumber}

Hi ${data.customerName},

${message}

Device: ${data.deviceLabel}
Status: ${label}${trackingLine}

Thank you for choosing ${data.merchantName}!

---
Powered by Baci — AI E-commerce Platform
  `.trim();
}

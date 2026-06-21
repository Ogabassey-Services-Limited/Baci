import { escapeHtmlAttribute, escapeHtmlText } from '@/lib/sanitize';
import type { MerchantRegistrationInfo } from './shared';
import {
  buildEscapedRegistrationLine,
  formatEmailMoney,
  getSafeHttpUrl,
} from './shared';

export interface VtuTokenReceiptData extends MerchantRegistrationInfo {
  transactionId: string;
  reference: string;
  customerName: string;
  amount: number;
  type: 'airtime' | 'data' | 'electricity' | 'cable_tv' | 'betting';
  providerLabel: string;
  customerIdentifier: string | null;
  voucherPin: string | null;
  phone_number?: string | null;
  merchantName: string;
  merchantUrl: string;
  currency?: string;
  supportEmail?: string;
}

/**
 * Generate VTU Utility Payment / Token Receipt Email - Baci Premium Design 2026
 */

export function generateVtuTokenReceiptEmail(
  data: VtuTokenReceiptData
): string {
  const isTokenReady = Boolean(data.voucherPin);
  const expectsToken =
    data.type === 'electricity' ||
    data.type === 'cable_tv' ||
    data.type === 'betting';
  const isTokenPending = expectsToken && !isTokenReady;
  const safeMerchantUrl = getSafeHttpUrl(data.merchantUrl) ?? '#';
  const safeMerchantHref = escapeHtmlAttribute(safeMerchantUrl);
  const merchantName = escapeHtmlAttribute(data.merchantName);
  const customerName = escapeHtmlAttribute(data.customerName);
  const providerLabel = escapeHtmlAttribute(data.providerLabel);
  const customerIdentifier = data.customerIdentifier
    ? escapeHtmlAttribute(data.customerIdentifier)
    : null;
  const contactPhone = data.phone_number
    ? escapeHtmlAttribute(data.phone_number)
    : null;
  const reference = escapeHtmlAttribute(data.reference);
  const voucherPin = data.voucherPin
    ? escapeHtmlAttribute(data.voucherPin)
    : null;
  const supportEmail = data.supportEmail
    ? escapeHtmlAttribute(data.supportEmail)
    : null;
  const registrationLine = buildEscapedRegistrationLine(data);
  const typeLabel =
    data.type === 'electricity'
      ? 'Electricity Token'
      : data.type === 'cable_tv'
        ? 'TV Decoder Subscription'
        : data.type === 'betting'
          ? 'Gaming Account Top-up'
          : data.type === 'airtime'
            ? 'Airtime Top-up'
            : 'Data Top-up';

  const accentColor = isTokenReady || expectsToken ? '#ca8a04' : '#10b981';
  const iconEmoji =
    data.type === 'electricity'
      ? '⚡'
      : data.type === 'cable_tv'
        ? '📺'
        : data.type === 'betting'
          ? '🎮'
          : '📱';

  const tokenSectionHtml = (() => {
    if (isTokenReady) {
      return `
    <!-- Token Pin Card -->
    <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px; border: 2px dashed #ca8a04; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
      <div style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">
        YOUR PREPAID TOKEN PIN
      </div>
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: 800; color: #facc15; letter-spacing: 2px; padding: 12px; background: #1e293b; border-radius: 8px; display: inline-block; word-break: break-all; max-width: 100%;">
        ${voucherPin}
      </div>
      <p style="margin: 12px 0 0 0; color: #cbd5e1; font-size: 14px; line-height: 1.5;">
        Enter this token directly into your meter or decoder to activate.
      </p>
    </div>
  `;
    }

    if (expectsToken) {
      return `
    <!-- Token Pending Card -->
    <div style="background-color: #fffbeb; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px; border: 1px solid #fde68a;">
      <div style="font-size: 12px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">
        TOKEN FULFILLMENT IN PROGRESS
      </div>
      <div style="font-size: 22px; font-weight: 800; color: #b45309; letter-spacing: 0.5px;">
        Payment Received
      </div>
      <p style="margin: 8px 0 0 0; color: #92400e; font-size: 14px; line-height: 1.5;">
        Your payment was successful. We are still retrieving the service token and will update this receipt once it is available.
      </p>
    </div>
  `;
    }

    return `
    <!-- Direct Success Card -->
    <div style="background-color: #f0fdf4; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px; border: 1px solid #bbf7d0;">
      <div style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">
        TRANSACTION STATUS
      </div>
      <div style="font-size: 22px; font-weight: 800; color: #15803d; letter-spacing: 0.5px;">
        Directly Successful & Active
      </div>
      <p style="margin: 8px 0 0 0; color: #166534; font-size: 14px; line-height: 1.5;">
        The recharge has been successfully credited directly to the target account. No PIN entry required.
      </p>
    </div>
  `;
  })();

  const detailsRows = [
    { label: 'Biller / Service', value: providerLabel },
    { label: 'Product Type', value: typeLabel },
    customerIdentifier
      ? {
          label:
            data.type === 'electricity'
              ? 'Meter Number'
              : data.type === 'cable_tv'
                ? 'Smartcard / Decoder Number'
                : 'Target Account',
          value: customerIdentifier,
        }
      : null,
    contactPhone ? { label: 'Contact Phone', value: contactPhone } : null,
    { label: 'Reference Number', value: reference },
  ].filter((item): item is { label: string; value: string } => item !== null);

  const detailsHtml = detailsRows
    .map(
      (row) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;">${row.label}</td>
      <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600; font-size: 14px; text-align: right;">${row.value}</td>
    </tr>
  `
    )
    .join('');
  const headerTitle = isTokenReady
    ? 'Token Delivery'
    : isTokenPending
      ? 'Token Pending'
      : 'Receipt Confirmation';
  const headerSubtitle = isTokenPending
    ? 'Your payment was received and token fulfillment is still in progress'
    : `Your ${typeLabel.toLowerCase()} is ready`;
  const introHtml = isTokenPending
    ? `Thank you for your purchase from <strong>${merchantName}</strong>. Your payment was successful and we're still retrieving the service token.`
    : `Thank you for your purchase from <strong>${merchantName}</strong>. Your payment was verified successfully and your utility vend request has been fulfilled.`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${typeLabel} Receipt</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f1f5f9; -webkit-font-smoothing: antialiased;">

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 40px 0;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="550" class="container" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05);">

          <!-- Banner / Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 36px 30px; border-bottom: 4px solid ${accentColor};">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left">
                    <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">${merchantName}</span>
                  </td>
                  <td align="right" style="color: #94a3b8; font-size: 13px;">
                    ${new Date().toLocaleDateString('en-GB')}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 24px;">
                    <div style="font-size: 32px; margin-bottom: 8px;">${iconEmoji}</div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; line-height: 1.2;">
                      ${headerTitle}
                    </h1>
                    <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 15px;">${headerSubtitle}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #1e293b; line-height: 1.5;">
                Hi <strong>${customerName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #475569; line-height: 1.6;">
                ${introHtml}
              </p>

              ${tokenSectionHtml}

              <!-- Purchase Details Table -->
              <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px;">
                Transaction Details
              </h3>

              <div style="background-color: #f8fafc; border-radius: 8px; padding: 8px 16px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tbody>
                    ${detailsHtml}
                    <tr>
                      <td style="padding: 16px 0 12px 0; color: #0f172a; font-weight: 700; font-size: 15px;">Total Amount</td>
                      <td style="padding: 16px 0 12px 0; color: ${accentColor}; font-weight: 800; font-size: 18px; text-align: right;">
                        ${escapeHtmlText(formatEmailMoney(data.amount, data.currency))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b;">
                Need help? Contact <a href="${safeMerchantHref}" style="color: ${accentColor}; text-decoration: none; font-weight: 600;">${merchantName} Support</a>
              </p>
              ${supportEmail ? `<p style="margin: 0 0 10px 0; font-size: 12px; color: #94a3b8;">Email: ${supportEmail}</p>` : ''}
              ${registrationLine ? `<p style="margin: 0 0 10px 0; font-size: 11px; color: #94a3b8;">${registrationLine}</p>` : ''}
              <p style="margin: 16px 0 0 0; font-size: 11px; color: #94a3b8; letter-spacing: 0.3px;">
                &copy; ${new Date().getFullYear()} ${merchantName}. Powered by <strong>Baci</strong>.
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

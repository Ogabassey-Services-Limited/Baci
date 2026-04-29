import { Share } from 'react-native';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { sanitizePlainTextForHtml } from '@/lib/sanitize-plain-text';

const TYPE_LABELS: Record<string, string> = {
  airtime: 'Airtime',
  data: 'Data',
  tv: 'TV',
  power: 'Electricity',
  gaming: 'Betting',
};

export interface UtilityReceiptData {
  amount?: number;
  customerIdentifier?: string;
  customerName?: string | null;
  reference?: string | null;
  status?: string;
  type: string;
  voucherPin?: string | null;
}

function buildReceiptRows(data: UtilityReceiptData) {
  const rows = [
    ['Service', TYPE_LABELS[data.type] ?? data.type],
    data.amount !== undefined && data.amount !== null
      ? ['Amount', formatNgnCurrency(data.amount)]
      : null,
    data.customerIdentifier ? ['Customer ID', data.customerIdentifier] : null,
    data.customerName ? ['Customer Name', data.customerName] : null,
    data.reference ? ['Reference', data.reference] : null,
    data.status ? ['Status', data.status] : null,
    data.voucherPin ? ['Voucher / Token', data.voucherPin] : null,
  ].filter((row): row is [string, string] => Boolean(row));

  return rows
    .map(
      ([label, value]) => `
        <div class="row">
          <span>${sanitizePlainTextForHtml(label)}</span>
          <strong>${sanitizePlainTextForHtml(value)}</strong>
        </div>`
    )
    .join('');
}

function buildReceiptMessage(data: UtilityReceiptData) {
  return [
    `${TYPE_LABELS[data.type] ?? data.type} receipt`,
    data.amount !== undefined && data.amount !== null
      ? `Amount: ${formatNgnCurrency(data.amount)}`
      : null,
    data.customerIdentifier ? `Customer ID: ${data.customerIdentifier}` : null,
    data.customerName ? `Customer: ${data.customerName}` : null,
    data.reference ? `Reference: ${data.reference}` : null,
    data.status ? `Status: ${data.status}` : null,
    data.voucherPin ? `Voucher / Token: ${data.voucherPin}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildUtilityReceiptHtml(data: UtilityReceiptData) {
  const serviceLabel = TYPE_LABELS[data.type] ?? data.type;
  const rows = buildReceiptRows(data);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        color: #111827;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
        padding: 32px;
      }
      .receipt {
        border: 1px solid #e5e7eb;
        border-radius: 18px;
        padding: 28px;
      }
      h1 {
        font-size: 24px;
        margin: 0 0 4px;
      }
      .subtitle {
        color: #6b7280;
        font-size: 14px;
        margin-bottom: 24px;
      }
      .row {
        border-top: 1px solid #f3f4f6;
        display: flex;
        gap: 16px;
        justify-content: space-between;
        padding: 14px 0;
      }
      .row span {
        color: #6b7280;
      }
      .row strong {
        max-width: 58%;
        text-align: right;
        word-break: break-word;
      }
    </style>
  </head>
  <body>
    <section class="receipt">
      <h1>${sanitizePlainTextForHtml(serviceLabel)} Receipt</h1>
      <div class="subtitle">Generated from your Baci utility purchase</div>
      ${rows}
    </section>
  </body>
</html>`;
}

export async function shareUtilityReceipt(data: UtilityReceiptData) {
  const html = buildUtilityReceiptHtml(data);
  let pdfUri: string | null = null;

  try {
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');
    const { uri } = await Print.printToFileAsync({ html });
    pdfUri = uri;

    if (!(await Sharing.isAvailableAsync())) {
      await Share.share({ message: buildReceiptMessage(data) });
      return;
    }

    await Sharing.shareAsync(uri, {
      dialogTitle: 'Share Utility Receipt',
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('cancelled') ||
        error.message.includes('canceled'))
    ) {
      return;
    }

    throw error;
  } finally {
    if (pdfUri) {
      try {
        const FileSystem = await import('expo-file-system');
        await FileSystem.deleteAsync(pdfUri, { idempotent: true });
      } catch {
        // Receipt sharing should not fail because a temporary PDF cleanup failed.
      }
    }
  }
}

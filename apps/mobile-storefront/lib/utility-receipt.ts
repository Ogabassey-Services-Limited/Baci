import { Share } from 'react-native';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { sanitizePlainTextForHtml } from '@/lib/sanitize-plain-text';
import { UTILITY_RECEIPT_CSS } from './utility-receipt-styles';

// Full Ogabassey wordmark logo (PNG on the CDN) — renders in the WebView preview
// and the generated PDF, unlike a bundled asset which can't be referenced by URL.
const OGABASSEY_RECEIPT_LOGO =
  'https://cdn.ogabassey.com/merchants/ogabassey/uploads/ogabassey-logo-2026-v1.png';

type UtilityReceiptType = 'airtime' | 'data' | 'tv' | 'power' | 'gaming';

const TYPE_LABELS = {
  airtime: 'Airtime',
  data: 'Data',
  tv: 'TV',
  power: 'Electricity',
  gaming: 'Betting',
} as const satisfies Record<UtilityReceiptType, string>;

function hasTypeLabel(type: string): type is UtilityReceiptType {
  return Object.hasOwn(TYPE_LABELS, type);
}

function getTypeLabel(type: UtilityReceiptData['type']): string {
  return hasTypeLabel(type) ? TYPE_LABELS[type] : type;
}

export interface UtilityReceiptData {
  type: UtilityReceiptType | (string & {});
  status?: string;
  amount?: number;
  reference?: string | null;
  customerName?: string | null;
  /** ISO string (or any Date-parseable value) of when the purchase happened. */
  dateTime?: string | null;
  /** e.g. "Wallet", "Card". */
  paidVia?: string | null;
  /** Cashback earned on this purchase, in naira. */
  cashback?: number | null;
  // Airtime / Data
  network?: string | null;
  phoneNumber?: string | null;
  dataPlan?: string | null;
  // Electricity / bills
  billerName?: string | null;
  meterNumber?: string | null;
  beneficiaryId?: string | null;
  address?: string | null;
  units?: string | null;
  // Prepaid meter token / voucher PIN (rendered prominently).
  token?: string | null;
  /** Back-compat alias for `token`. */
  voucherPin?: string | null;
  /** Generic identifier fallback when a type-specific field is not supplied. */
  customerIdentifier?: string | null;
}

function formatReceiptDateTime(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  try {
    return parsed.toLocaleString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return parsed.toISOString();
  }
}

function getStatusMeta(status?: string): { label: string; color: string } {
  const normalized = (status ?? 'successful').toLowerCase();
  if (normalized === 'failed' || normalized === 'error') {
    return { label: 'Failed', color: '#DC2626' };
  }
  if (normalized === 'pending' || normalized === 'processing') {
    return { label: 'Pending', color: '#D97706' };
  }
  return { label: 'Successful', color: '#059669' };
}

function getReceiptToken(data: UtilityReceiptData): string | null {
  return data.token ?? data.voucherPin ?? null;
}

// Type-aware detail rows. The generic `customerIdentifier` is used as a labeled
// fallback (Phone Number / Meter Number) when a specific field is not supplied,
// so older callers keep working.
function getDetailRows(data: UtilityReceiptData): [string, string][] {
  const isAirtimeLike = data.type === 'airtime' || data.type === 'data';
  const isPower = data.type === 'power';

  const entries: ([string, string | null | undefined] | null)[] = [];

  if (isAirtimeLike) {
    entries.push(['Network', data.network]);
    entries.push(['Phone Number', data.phoneNumber ?? data.customerIdentifier]);
    if (data.type === 'data') entries.push(['Data Plan', data.dataPlan]);
  } else if (isPower) {
    entries.push(['Biller', data.billerName]);
    entries.push(['Meter Number', data.meterNumber ?? data.customerIdentifier]);
    entries.push(['Beneficiary ID', data.beneficiaryId]);
    entries.push(['Units', data.units]);
    entries.push(['Address', data.address]);
  } else {
    entries.push(['Biller', data.billerName]);
    entries.push(['Customer ID', data.customerIdentifier]);
  }

  entries.push(['Customer Name', data.customerName]);
  entries.push(['Date & Time', formatReceiptDateTime(data.dateTime)]);
  entries.push(['Reference', data.reference]);
  entries.push(['Paid With', data.paidVia]);

  return entries
    .filter((row): row is [string, string] => Boolean(row?.[1]))
    .map(([label, value]) => [label, String(value)]);
}

function renderRows(rows: [string, string][]): string {
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
  const token = getReceiptToken(data);
  return [
    `${getTypeLabel(data.type)} receipt`,
    data.amount !== undefined && data.amount !== null
      ? `Amount: ${formatNgnCurrency(data.amount)}`
      : null,
    data.network ? `Network: ${data.network}` : null,
    data.phoneNumber ? `Phone: ${data.phoneNumber}` : null,
    data.billerName ? `Biller: ${data.billerName}` : null,
    data.customerIdentifier ? `Customer ID: ${data.customerIdentifier}` : null,
    data.customerName ? `Customer: ${data.customerName}` : null,
    data.reference ? `Reference: ${data.reference}` : null,
    data.status ? `Status: ${data.status}` : null,
    token ? `Token: ${token}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function isCancellationError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    error instanceof Error &&
    // Expo Sharing reports user cancellation through localized native error
    // strings rather than a stable cancellation code.
    (message.includes('cancelled') || message.includes('canceled'))
  );
}

export function buildUtilityReceiptHtml(data: UtilityReceiptData) {
  const serviceLabel = getTypeLabel(data.type);
  const status = getStatusMeta(data.status);
  const rows = renderRows(getDetailRows(data));
  const token = getReceiptToken(data);
  const amountText =
    data.amount !== undefined && data.amount !== null
      ? formatNgnCurrency(data.amount)
      : null;

  const tokenBlock = token
    ? `<div class="token">
        <div class="label">${data.type === 'power' ? 'Meter Token' : 'Token'}</div>
        <div class="value">${sanitizePlainTextForHtml(token)}</div>
        <div class="note">Keep this safe — you'll need it to recharge.</div>
      </div>`
    : '';

  const cashbackBlock =
    data.cashback && data.cashback > 0
      ? `<div class="cashback"><span>Cashback earned</span><span>${sanitizePlainTextForHtml(
          formatNgnCurrency(data.cashback)
        )}</span></div>`
      : '';

  const amountBlock = amountText
    ? `<div class="hero"><div class="label">Amount</div><div class="amount">${sanitizePlainTextForHtml(
        amountText
      )}</div></div>`
    : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${UTILITY_RECEIPT_CSS}</style>
  </head>
  <body>
    <section class="sheet">
      <div class="brandbar">
        <span class="bar-black"></span>
        <span class="bar-gap"></span>
        <span class="bar-red"></span>
      </div>
      <div class="head">
        <img class="logo" src="${OGABASSEY_RECEIPT_LOGO}" alt="Ogabassey" />
        <div class="doc">${sanitizePlainTextForHtml(serviceLabel)} Receipt</div>
        <div class="status" style="color:${status.color}">${status.label}</div>
      </div>
      ${amountBlock}
      <div class="body">${rows}</div>
      ${tokenBlock}
      ${cashbackBlock}
      <div class="foot">
        <div class="thanks">Thank you for using Ogabassey</div>
        Need help? Contact support with your reference above.
      </div>
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

    if (!(await Sharing.isAvailableAsync())) {
      await Share.share({ message: buildReceiptMessage(data) });
      return;
    }

    try {
      const { uri } = await Print.printToFileAsync({ html });
      pdfUri = uri;
    } catch {
      await Share.share({ message: buildReceiptMessage(data) });
      return;
    }

    await Sharing.shareAsync(pdfUri, {
      dialogTitle: 'Share Utility Receipt',
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    if (isCancellationError(error)) {
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

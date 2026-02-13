/**
 * Receipt/Invoice HTML Generator (Multi-Tenant)
 *
 * Generates a self-contained HTML document styled for PDF export via expo-print.
 * Dynamically adapts to each merchant's brand: logo, colors, business info.
 * Supports paid receipts, unpaid invoices, and partial payment breakdowns.
 */

// ---------------------------------------------------------------------------
// Bank code → name mapping (common Nigerian banks)
// ---------------------------------------------------------------------------
const BANK_NAMES: Record<string, string> = {
  '044': 'Access Bank',
  '023': 'Citibank Nigeria',
  '063': 'Diamond Bank',
  '050': 'Ecobank Nigeria',
  '070': 'Fidelity Bank',
  '011': 'First Bank of Nigeria',
  '214': 'First City Monument Bank',
  '058': 'Guaranty Trust Bank',
  '030': 'Heritage Bank',
  '301': 'Jaiz Bank',
  '082': 'Keystone Bank',
  '526': 'Parallex Bank',
  '076': 'Polaris Bank',
  '101': 'Providus Bank',
  '221': 'Stanbic IBTC Bank',
  '068': 'Standard Chartered Bank',
  '232': 'Sterling Bank',
  '100': 'Suntrust Bank',
  '032': 'Union Bank of Nigeria',
  '033': 'United Bank for Africa',
  '215': 'Unity Bank',
  '035': 'Wema Bank',
  '057': 'Zenith Bank',
  '999992': 'Opay',
  '50515': 'Moniepoint',
  '999991': 'PalmPay',
  '090110': 'VFD Microfinance Bank',
  '090267': 'Kuda Bank',
};

function getBankNameFromCode(code: string | null): string | null {
  if (!code) return null;
  return BANK_NAMES[code] || null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReceiptMerchant {
  business_name: string | null;
  logo_url: string | null;
  email: string;
  phone: string | null;
  support_email: string | null;
  support_phone: string | null;
  business_address: string | null;
  cac_rc_number: string | null;
  brand_colors?: { primary: string; background: string; accent: string };
  vat_registration_status: string | null;
  vat_rate: number | null;
  bank_code: string | null;
  bank_account_number: string | null;
  bank_name?: string | null;
  bank_account_name?: string | null;
  social_media?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
  } | null;
}

export interface ReceiptOrder {
  order_number: string;
  created_at: string;
  currency: string;
  total: number;
  subtotal: number;
  shipping_fee: number;
  tax_amount: number;
  discount_amount: number;
  amount_paid: number;
  balance: number;
  payment_status: string;
  payment_method: string | null;
  is_credit_order?: boolean;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address?: {
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  } | null;
  virtual_account?: {
    account_number: string;
    bank_name: string;
    account_name: string;
  } | null;
  items: Array<{
    product_name: string;
    name?: string;
    quantity: number;
    price: number;
  }>;
  transactions?: Array<{
    amount: number;
    created_at: string;
    description: string | null;
    metadata: { payment_method?: string } | null;
  }>;
}

interface ReceiptOptions {
  qrCodeDataUri?: string;
  storeUrl?: string;
  paymentLink?: string;
}

// ---------------------------------------------------------------------------
// Helpers (private)
// ---------------------------------------------------------------------------

const CURRENCY_LOCALE_MAP: Record<string, string> = {
  NGN: 'en-NG',
  GHS: 'en-GH',
  KES: 'en-KE',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  ZAR: 'en-ZA',
  XAF: 'fr-CM',
  XOF: 'fr-SN',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const r = Number.parseInt(cleaned.substring(0, 2), 16);
  const g = Number.parseInt(cleaned.substring(2, 4), 16);
  const b = Number.parseInt(cleaned.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(26, 26, 46, ${alpha})`; // fallback
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------------------------------------------------------------------------
// Main Generator
// ---------------------------------------------------------------------------

export function generateReceiptHtml(
  order: ReceiptOrder,
  merchant: ReceiptMerchant,
  options: ReceiptOptions = {}
): string {
  // -- Design tokens (derived from merchant's extracted brand colors) --
  const brandPrimary = merchant.brand_colors?.primary || '#1a1a2e';
  const brandAccent = merchant.brand_colors?.accent || brandPrimary;
  const brandLight = hexToRgba(brandPrimary, 0.06);
  const _brandCardBg = hexToRgba(brandPrimary, 0.03);
  const brandCardBorder = hexToRgba(brandPrimary, 0.12);

  const isPaid = order.payment_status === 'paid';
  const isPartial = order.payment_status === 'partially_paid';

  const statusConfig = isPaid
    ? {
        label: 'PAID',
        color: '#059669',
        bg: 'rgba(5,150,105,0.06)',
        border: 'rgba(5,150,105,0.18)',
        watermark: 'rgba(5,150,105,0.07)',
        wmBorder: 'rgba(5,150,105,0.12)',
      }
    : isPartial
      ? {
          label: 'PARTIALLY PAID',
          color: '#d97706',
          bg: 'rgba(217,119,6,0.06)',
          border: 'rgba(217,119,6,0.18)',
          watermark: 'rgba(217,119,6,0.07)',
          wmBorder: 'rgba(217,119,6,0.12)',
        }
      : {
          label: 'UNPAID',
          color: '#dc2626',
          bg: 'rgba(220,38,38,0.06)',
          border: 'rgba(220,38,38,0.18)',
          watermark: 'rgba(220,38,38,0.07)',
          wmBorder: 'rgba(220,38,38,0.12)',
        };

  const docTitle = isPaid ? 'Receipt' : 'Invoice';

  // -- Currency formatter --
  const currencyCode = order.currency || 'NGN';
  const locale = CURRENCY_LOCALE_MAP[currencyCode] || 'en-NG';
  const fmt = (amount: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  // -- Date formatting --
  const orderDate = new Date(order.created_at);
  const dateStr = orderDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = orderDate.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // -- Merchant info --
  const storeName = escapeHtml(merchant.business_name || merchant.email);
  const contactEmail = merchant.support_email || merchant.email;
  const contactPhone = merchant.support_phone || merchant.phone;

  // -- Address (street, city+state, phone, email) --
  const addr = order.shipping_address;
  const addressParts = [
    addr?.address_line1,
    addr?.address_line2,
    [addr?.city, addr?.state].filter(Boolean).join(', '),
  ].filter(Boolean);

  // -- Logo --
  const logoHtml = merchant.logo_url
    ? `<img src="${escapeHtml(merchant.logo_url)}" alt="${storeName}" style="max-height:40px;max-width:140px;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div style="display:none" class="logo-fallback">${storeName}</div>`
    : `<div class="logo-fallback">${storeName}</div>`;

  // -- Items rows --
  const itemRows =
    order.items.length > 0
      ? order.items
          .map(
            (item, i) => `
      <tr class="${i % 2 === 1 ? 'zebra' : ''}">
        <td class="cell-num">${i + 1}</td>
        <td class="cell-item">${escapeHtml(item.product_name || item.name || 'Item')}</td>
        <td class="cell-qty">${item.quantity}</td>
        <td class="cell-price">${fmt(item.price)}</td>
        <td class="cell-total">${fmt(item.price * item.quantity)}</td>
      </tr>`
          )
          .join('')
      : '<tr><td colspan="5" style="text-align:center;padding:16px;color:#9ca3af;">No items</td></tr>';

  // -- Financial summary lines --
  const summaryLines: string[] = [];
  summaryLines.push(
    `<div class="sum-row"><span>Subtotal</span><span>${fmt(order.subtotal)}</span></div>`
  );

  if (order.shipping_fee > 0) {
    summaryLines.push(
      `<div class="sum-row"><span>Shipping</span><span>${fmt(order.shipping_fee)}</span></div>`
    );
  } else {
    summaryLines.push(
      '<div class="sum-row"><span>Shipping</span><span style="color:#059669;font-weight:600;">Free</span></div>'
    );
  }

  if (order.discount_amount > 0) {
    summaryLines.push(
      `<div class="sum-row"><span>Discount</span><span style="color:#dc2626;font-weight:600;">-${fmt(order.discount_amount)}</span></div>`
    );
  }

  const showVat =
    merchant.vat_registration_status === 'registered' && order.tax_amount > 0;
  if (showVat) {
    const vatLabel = merchant.vat_rate ? `VAT (${merchant.vat_rate}%)` : 'VAT';
    summaryLines.push(
      `<div class="sum-row"><span>${vatLabel}</span><span>${fmt(order.tax_amount)}</span></div>`
    );
  }

  // Separator + total
  summaryLines.push('<div class="sum-divider"></div>');
  summaryLines.push(
    `<div class="sum-row sum-total"><span>Total</span><span>${fmt(order.total)}</span></div>`
  );

  if (!isPaid) {
    if (order.amount_paid > 0) {
      summaryLines.push(
        `<div class="sum-row sum-paid"><span>Amount Paid</span><span style="color:#059669;">-${fmt(order.amount_paid)}</span></div>`
      );
    }
    summaryLines.push(
      `<div class="sum-row sum-due"><span>Balance Due</span><span style="color:${statusConfig.color};font-weight:800;">${fmt(order.balance)}</span></div>`
    );
  }

  // -- Payment history --
  let paymentHistoryHtml = '';
  if (order.transactions && order.transactions.length > 0) {
    const txRows = order.transactions
      .map((tx) => {
        const txDate = new Date(tx.created_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const method =
          tx.metadata?.payment_method || tx.description || 'Payment';
        return `<tr><td>${txDate}</td><td>${escapeHtml(method)}</td><td style="text-align:right;font-weight:600;color:#059669;">${fmt(tx.amount)}</td></tr>`;
      })
      .join('');

    paymentHistoryHtml = `
      <div class="section-block">
        <div class="section-label">Payment History</div>
        <table class="tx-table">
          <thead><tr><th>Date</th><th>Method</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>${txRows}</tbody>
        </table>
      </div>`;
  }

  // -- Bank details (unpaid only — show both DVA + merchant bank when available) --
  let bankDetailsHtml = '';
  if (!isPaid) {
    const parts: string[] = [];

    // DVA card — tagged "Automatic Confirmation"
    // Display as "MerchantName/CustomerName" on invoices for clarity.
    if (order.virtual_account) {
      const va = order.virtual_account;
      const customerName = order.customer_name?.split(' ')[0] || '';
      const dvaDisplayName =
        merchant.business_name && customerName
          ? `${merchant.business_name}/${customerName}`
          : merchant.business_name || va.account_name;
      parts.push(`
        <div class="bank-card">
          <div class="bank-label" style="display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${brandPrimary};flex-shrink:0;"></span>
            Automatic Confirmation
          </div>
          <div class="bank-hint">Transfer here for instant order confirmation</div>
          <div class="bank-row"><span class="bank-key">Bank</span><span class="bank-val">${escapeHtml(va.bank_name)}</span></div>
          <div class="bank-row"><span class="bank-key">Account Name</span><span class="bank-val">${escapeHtml(dvaDisplayName)}</span></div>
          <div class="bank-row"><span class="bank-key">Account Number</span><span class="bank-val bank-acct">${escapeHtml(va.account_number)}</span></div>
        </div>`);
    }

    // Merchant bank card — tagged "Manual Confirmation"
    if (merchant.bank_account_number) {
      const rawBankName = merchant.bank_name?.trim();
      const hasValidBankName =
        rawBankName &&
        rawBankName.toLowerCase() !== 'unknown' &&
        rawBankName.toLowerCase() !== 'unknown bank' &&
        rawBankName.toLowerCase() !== 'n/a';
      const resolvedBankName = hasValidBankName
        ? rawBankName
        : getBankNameFromCode(merchant.bank_code) || '';
      if (resolvedBankName) {
        // Contact icons for manual confirmation
        const phoneIcon = contactPhone
          ? `<a href="tel:${escapeHtml(contactPhone)}" style="display:inline-flex;align-items:center;gap:4px;color:${brandPrimary};text-decoration:none;font-size:10px;font-weight:600;">&#9742; ${escapeHtml(contactPhone)}</a>`
          : '';
        const emailIcon = contactEmail
          ? `<a href="mailto:${escapeHtml(contactEmail)}" style="display:inline-flex;align-items:center;gap:4px;color:${brandPrimary};text-decoration:none;font-size:10px;font-weight:600;">&#9993; ${escapeHtml(contactEmail)}</a>`
          : '';
        const contactRow =
          phoneIcon || emailIcon
            ? `<div class="bank-contact">${phoneIcon}${phoneIcon && emailIcon ? '<span style="color:#d1d5db;margin:0 6px;">|</span>' : ''}${emailIcon}</div>`
            : '';

        parts.push(`
          <div class="bank-card">
            <div class="bank-label" style="display:flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${brandAccent};flex-shrink:0;"></span>
              Manual Confirmation
            </div>
            <div class="bank-hint">Transfer here &amp; notify merchant to confirm</div>
            <div class="bank-row"><span class="bank-key">Bank</span><span class="bank-val">${escapeHtml(resolvedBankName)}</span></div>
            <div class="bank-row"><span class="bank-key">Account Name</span><span class="bank-val">${escapeHtml(merchant.bank_account_name || merchant.business_name || '')}</span></div>
            <div class="bank-row"><span class="bank-key">Account Number</span><span class="bank-val bank-acct">${escapeHtml(merchant.bank_account_number)}</span></div>
            ${contactRow}
          </div>`);
      }
    }

    // Payment link card
    if (options.paymentLink) {
      parts.push(`
        <div class="bank-card">
          <div class="bank-label">Pay Online</div>
          <div style="text-align:center;padding:8px 0;">
            <a href="${escapeHtml(options.paymentLink)}" style="display:inline-block;padding:8px 20px;background:${brandPrimary};color:#fff;border-radius:6px;text-decoration:none;font-weight:700;font-size:12px;">Pay Now</a>
          </div>
          <div style="font-size:9px;color:#9ca3af;text-align:center;margin-top:6px;word-break:break-all;">${escapeHtml(options.paymentLink)}</div>
        </div>`);
    }
    if (parts.length > 0) {
      bankDetailsHtml = `
        <div class="section-block">
          <div class="section-label">Payment Instructions</div>
          <div class="bank-grid">${parts.join('')}</div>
        </div>`;
    }
  }

  // -- QR code --
  const qrHtml = options.qrCodeDataUri
    ? `<div class="qr-block"><img src="${options.qrCodeDataUri}" alt="QR Code" width="100" height="100"><div class="qr-caption">${isPaid ? 'Track your order' : 'Pay online'}</div></div>`
    : '';

  // -- Social handles --
  const social = merchant.social_media;
  const handles = [
    social?.instagram ? `@${social.instagram}` : null,
    social?.twitter ? `@${social.twitter}` : null,
    social?.tiktok ? `@${social.tiktok}` : null,
  ].filter(Boolean);
  const socialHtml =
    handles.length > 0
      ? `<div class="social">${handles.join(' &middot; ')}</div>`
      : '';

  // -- Terms & conditions link --
  const termsHtml = options.storeUrl
    ? `<div class="terms"><a href="https://${escapeHtml(options.storeUrl)}/terms">Terms & Conditions</a></div>`
    : '';

  // -- Compose HTML --
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=794">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 210mm; min-height: 297mm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1f2937;
    background: #fff;
    font-size: 13px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    background: #fff;
    width: 210mm;
    min-height: 297mm;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Top accent bar */
  .accent-bar { height: 4px; flex-shrink: 0; background: ${brandPrimary}; }

  /* Items wrapper — watermark anchors to this */
  .items-wrapper {
    position: relative;
  }
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-28deg);
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 56px;
    font-weight: 900;
    letter-spacing: 5px;
    color: ${statusConfig.watermark};
    border: 4px dashed ${statusConfig.wmBorder};
    border-radius: 10px;
    padding: 6px 22px;
    pointer-events: none;
    white-space: nowrap;
    z-index: 0;
    user-select: none;
  }

  .content { padding: 24px 28px 20px; position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .logo-fallback { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
  .merchant-info { margin-top: 6px; font-size: 12px; color: #6b7280; line-height: 1.5; }
  .merchant-info strong { color: #374151; font-weight: 600; }
  .doc-meta { text-align: right; }
  .doc-title { font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 800; color: #111827; text-transform: uppercase; letter-spacing: 1px; }
  .doc-number { font-size: 13px; font-weight: 600; color: #6b7280; margin-top: 3px; }
  .doc-date { font-size: 12px; color: #9ca3af; margin-top: 2px; }
  .status-badge {
    display: inline-block;
    margin-top: 6px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    border-radius: 4px;
    color: ${statusConfig.color};
    background: ${statusConfig.bg};
    border: 1px solid ${statusConfig.border};
  }

  /* Bill To / Payment grid */
  .info-grid { display: flex; gap: 24px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid ${brandCardBorder}; }
  .info-col { flex: 1; }
  .info-col-right { text-align: right; }
  .info-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: ${brandPrimary}; margin-bottom: 4px; }
  .info-name { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 2px; }
  .info-detail { font-size: 12px; color: #6b7280; line-height: 1.5; }

  /* Items table */
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .items-table thead th {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #6b7280;
    padding: 8px 6px;
    border-bottom: 2px solid ${brandPrimary};
    background: ${brandLight};
  }
  .items-table thead th:first-child { padding-left: 10px; border-radius: 4px 0 0 0; }
  .items-table thead th:last-child { border-radius: 0 4px 0 0; }
  .items-table tbody td {
    padding: 10px 6px;
    font-size: 13px;
    color: #374151;
    border-bottom: 1px solid #f8fafc;
    vertical-align: top;
  }
  .items-table tbody tr.zebra td { background: #fafbfc; }
  .cell-num { width: 28px; color: #9ca3af; text-align: center; }
  .cell-item { font-weight: 600; color: #111827; word-break: break-word; }
  .cell-qty { text-align: center; white-space: nowrap; padding-right: 12px; }
  .cell-price { text-align: right; white-space: nowrap; font-family: 'SF Mono', Menlo, Monaco, monospace; font-size: 12px; padding-right: 12px; }
  .cell-total { text-align: right; white-space: nowrap; font-family: 'SF Mono', Menlo, Monaco, monospace; font-size: 12px; font-weight: 700; color: #111827; }

  /* Financial summary */
  .summary { display: flex; justify-content: flex-end; margin-bottom: 18px; }
  .summary-inner { width: 240px; }
  .sum-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: #4b5563; }
  .sum-row span:last-child { font-family: 'SF Mono', Menlo, Monaco, monospace; font-size: 13px; }
  .sum-divider { border-top: 2px solid ${brandPrimary}; margin: 6px 0; }
  .sum-total { font-size: 15px; font-weight: 800; color: #111827; padding: 3px 0; }
  .sum-total span:last-child { font-family: 'SF Mono', Menlo, Monaco, monospace; font-size: 15px; }
  .sum-paid { padding-top: 8px; }
  .sum-due { font-size: 14px; font-weight: 700; padding-top: 2px; }

  /* Sections (payment history, bank details) */
  .section-block { margin-bottom: 16px; }
  .section-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #1a1a2e; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }

  /* Transaction table */
  .tx-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .tx-table th { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; padding: 6px 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
  .tx-table td { padding: 8px; color: #374151; border-bottom: 1px solid #f3f4f6; }

  /* Bank details */
  .bank-grid { display: flex; gap: 16px; }
  .bank-card { flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
  .bank-label { font-size: 10px; font-weight: 700; color: #1a1a2e; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .bank-row { display: flex; justify-content: space-between; padding: 3px 0; }
  .bank-key { font-size: 10px; color: #9ca3af; }
  .bank-val { font-size: 11px; font-weight: 600; color: #111827; }
  .bank-acct { font-family: 'SF Mono', Menlo, Monaco, monospace; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; }
  .bank-hint { font-size: 9px; color: #6b7280; margin-bottom: 8px; font-style: italic; }
  .bank-contact { display: flex; align-items: center; flex-wrap: wrap; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }

  /* QR code */
  .qr-block { text-align: center; margin: 14px 0; }
  .qr-block img { border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px; background: #fff; }
  .qr-caption { font-size: 10px; color: #9ca3af; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }

  /* Footer */
  .footer-area { margin-top: auto; padding-top: 14px; border-top: 1px solid ${brandCardBorder}; text-align: center; }
  .footer-contact { font-size: 12px; color: #4b5563; margin-bottom: 3px; }
  .footer-contact a { color: ${brandPrimary}; text-decoration: none; font-weight: 600; }
  .footer-rc { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
  .social { font-size: 11px; color: #6b7280; margin-bottom: 6px; }
  .terms { font-size: 10px; color: #6b7280; margin-bottom: 6px; }
  .terms a { color: ${brandPrimary}; text-decoration: none; font-weight: 600; }
  .powered { font-size: 9px; color: #cbd5e1; text-transform: uppercase; letter-spacing: 2px; }
</style>
</head>
<body>
<div class="page">
  <div class="accent-bar"></div>
  <div class="content">

    <!-- Header -->
    <div class="header">
      <div>
        ${logoHtml}
        <div class="merchant-info">
          ${merchant.business_address ? `<div>${escapeHtml(merchant.business_address)}</div>` : ''}
          ${contactPhone ? `<div>${escapeHtml(contactPhone)}</div>` : ''}
          ${contactEmail ? `<div>${escapeHtml(contactEmail)}</div>` : ''}
          ${merchant.cac_rc_number ? `<div><strong>RC: ${escapeHtml(merchant.cac_rc_number)}</strong></div>` : ''}
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-title">${docTitle}</div>
        <div class="doc-number">#${escapeHtml(order.order_number)}</div>
        <div class="doc-date">${dateStr} &middot; ${timeStr}</div>
        <div class="status-badge">${statusConfig.label}</div>
      </div>
    </div>

    <!-- Bill To / Payment Info -->
    <div class="info-grid">
      <div class="info-col">
        <div class="info-label">Billed To</div>
        <div class="info-name">${escapeHtml(order.customer_name)}</div>
        <div class="info-detail">
          ${addressParts.map((p) => `<div>${escapeHtml(p as string)}</div>`).join('')}
          ${order.customer_phone ? `<div>${escapeHtml(order.customer_phone)}</div>` : ''}
          ${order.customer_email ? `<div>${escapeHtml(order.customer_email)}</div>` : ''}
        </div>
      </div>
      <div class="info-col info-col-right">
        <div class="info-label">${isPaid ? 'Payment' : 'Invoice Info'}</div>
        <div class="info-name">${isPaid ? escapeHtml(order.payment_method || 'Verified') : 'Pending'}</div>
        <div class="info-detail">
          <div>${docTitle} #${escapeHtml(order.order_number)}</div>
          <div>${dateStr}</div>
          ${order.is_credit_order ? '<div style="color:#d97706;font-weight:600;">Credit Order</div>' : ''}
        </div>
      </div>
    </div>

    <!-- Items Table + Watermark -->
    <div class="items-wrapper">
      <div class="watermark">${statusConfig.label}</div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="text-align:center;">#</th>
            <th>Item</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Price</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Financial Summary -->
      <div class="summary">
        <div class="summary-inner">
          ${summaryLines.join('\n          ')}
        </div>
      </div>
    </div>

    <!-- Payment History -->
    ${paymentHistoryHtml}

    <!-- Bank Details -->
    ${bankDetailsHtml}

    <!-- QR Code -->
    ${qrHtml}

    <!-- Footer -->
    <div class="footer-area">
      <div class="footer-contact">
        Questions? Contact
        ${contactEmail ? ` <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>` : ''}
      </div>
      ${merchant.cac_rc_number ? `<div class="footer-rc">RC: ${escapeHtml(merchant.cac_rc_number)}</div>` : ''}
      ${socialHtml}
      ${termsHtml}
      <div class="powered">Powered by Baci &middot; usebaci.com</div>
    </div>

  </div>
</div>
</body>
</html>`;
}

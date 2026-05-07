/**
 * Receipt/Invoice HTML Generator (Multi-Tenant)
 *
 * Generates a self-contained HTML document styled for PDF export via expo-print.
 * Dynamically adapts to each merchant's brand: logo, colors, business info.
 * Supports paid receipts, unpaid invoices, and partial payment breakdowns.
 */

import { getBankNameFromCode } from './bank-codes';
import { escapeHtml, escapeJsString } from './escape-html';
import { sanitizeSvg } from './sanitize-svg';
import type { ReceiptMerchant, ReceiptOptions, ReceiptOrder } from './types';

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

const SOCIAL_HOSTS: Record<string, readonly string[]> = {
  instagram: ['instagram.com'],
  facebook: ['facebook.com', 'fb.com'],
  twitter: ['x.com', 'twitter.com'],
  tiktok: ['tiktok.com'],
};

const IG_RESERVED_PATHS = new Set([
  'accounts',
  'explore',
  'p',
  'reel',
  'reels',
  'stories',
]);
const FACEBOOK_RESERVED_PATHS = new Set([
  'events',
  'groups',
  'marketplace',
  'people',
  'profile.php',
  'share',
  'sharer',
  'watch',
]);
const TWITTER_RESERVED_PATHS = new Set(['home', 'i', 'intent', 'share']);
const TIKTOK_RESERVED_PATHS = new Set(['discover', 'foryou', 'tag', 'video']);
const MONEY_TOLERANCE = 0.01;

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

function almostEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= MONEY_TOLERANCE;
}

function shouldShowVatLine(order: ReceiptOrder, merchant: ReceiptMerchant) {
  if (
    merchant.vat_registration_status !== 'registered' ||
    order.tax_amount <= 0
  ) {
    return false;
  }

  const totalBeforeTax =
    order.subtotal - order.discount_amount + order.shipping_fee;
  return almostEqual(order.total, totalBeforeTax + order.tax_amount);
}

function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isSocialHost(platform: string, hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '');
  return (
    SOCIAL_HOSTS[platform]?.some(
      (host) => normalizedHost === host || normalizedHost.endsWith(`.${host}`)
    ) ?? false
  );
}

function getFirstProfileSegment(
  segments: string[],
  reservedPaths: Set<string>
): string | null {
  const segment = segments.find(
    (part) => !reservedPaths.has(part.toLowerCase())
  );
  return segment ?? null;
}

function normalizePlainSocialHandle(value: string): string | null {
  const handle = value
    .trim()
    .replace(/^@+/, '')
    .split(/[/?#&]/)[0]
    .replace(/^@+/, '')
    .trim();
  const normalized = handle.replace(/[^a-zA-Z0-9._-]/g, '');
  return normalized || null;
}

function getFirstNonBlankValue(
  ...values: Array<string | null | undefined>
): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

function getFacebookProfileId(url: URL, segments: string[]): string | null {
  if (segments[0]?.toLowerCase() !== 'profile.php') {
    return null;
  }

  return normalizePlainSocialHandle(url.searchParams.get('id') ?? '');
}

function normalizeSocialHandle(
  platform: 'instagram' | 'facebook' | 'twitter' | 'tiktok',
  value: string | undefined
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const canParseAsUrl =
    /^https?:\/\//i.test(trimmed) ||
    /^(www\.)?(instagram|facebook|fb|x|twitter|tiktok)\.com\//i.test(trimmed);

  if (!canParseAsUrl) {
    return normalizePlainSocialHandle(trimmed);
  }

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    );
    if (!isSocialHost(platform, url.hostname)) {
      return normalizePlainSocialHandle(trimmed);
    }

    const segments = url.pathname
      .split('/')
      .map((part) => safeDecodeUriComponent(part).trim())
      .filter(Boolean);
    let profileSegment: string | null = null;

    if (platform === 'instagram') {
      profileSegment = getFirstProfileSegment(segments, IG_RESERVED_PATHS);
    } else if (platform === 'facebook') {
      profileSegment =
        getFacebookProfileId(url, segments) ??
        getFirstProfileSegment(segments, FACEBOOK_RESERVED_PATHS);
    } else if (platform === 'twitter') {
      profileSegment = getFirstProfileSegment(segments, TWITTER_RESERVED_PATHS);
    } else {
      profileSegment =
        segments.find((part) => part.startsWith('@')) ??
        getFirstProfileSegment(segments, TIKTOK_RESERVED_PATHS);
    }

    return normalizePlainSocialHandle(profileSegment ?? '');
  } catch {
    return normalizePlainSocialHandle(trimmed);
  }
}

function getReceiptFulfillmentRows(order: ReceiptOrder) {
  const details = order.fulfillment_details;
  const imei = getFirstNonBlankValue(details?.imei);
  const serialNumber = getFirstNonBlankValue(
    details?.serialNumber,
    details?.serial_number
  );

  return [
    { label: 'IMEI', value: imei },
    { label: 'S/N', value: serialNumber },
  ].filter((row) => row.value.length > 0);
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
  const rawStoreName =
    merchant.legal_entity_name || merchant.business_name || merchant.email;
  const storeName = escapeHtml(rawStoreName);
  // JS-safe version for use in inline event handlers (onerror, etc.)
  const storeNameForJs = escapeJsString(rawStoreName);
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
  let logoHtml = '';
  if (options.svgXml) {
    logoHtml = `<div class="logo-svg">${sanitizeSvg(options.svgXml)}</div>`;
  } else if (merchant.logo_url) {
    // Use JS-safe escaping for the onerror handler to prevent XSS via store name
    logoHtml = `<img src="${escapeHtml(merchant.logo_url)}" alt="${storeName}" class="logo-img" style="display: block !important;" onerror="this.src='https://placehold.co/200x80?text=' + encodeURIComponent('${storeNameForJs}')">`;
  } else {
    logoHtml = `<div class="logo-fallback">${storeName}</div>`;
  }

  // -- Items rows --
  const itemRows =
    order.items.length > 0
      ? order.items
          .map((item, i) => {
            const baseName = item.product_name || item.name || 'Item';
            const itemLabel = item.variant_name
              ? `${baseName} (${item.variant_name})`
              : baseName;

            return `
      <tr class="${i % 2 === 1 ? 'zebra' : ''}">
        <td class="cell-num">${i + 1}</td>
        <td class="cell-item">${escapeHtml(itemLabel)}</td>
        <td class="cell-qty">${item.quantity}</td>
        <td class="cell-price">${fmt(item.price)}</td>
        <td class="cell-total">${fmt(item.price * item.quantity)}</td>
      </tr>`;
          })
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

  const showVat = shouldShowVatLine(order, merchant);
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
    // Use the actual account_name from Paystack (e.g. "Ogabassey/Mera Ibrahim")
    if (order.virtual_account) {
      const va = order.virtual_account;
      const dvaDisplayName = va.account_name;
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

  const fulfillmentRows = getReceiptFulfillmentRows(order);
  const fulfillmentDetailsHtml =
    fulfillmentRows.length > 0
      ? `
      <div class="section-block">
        <div class="section-label">Fulfillment Details</div>
        <div class="fulfillment-grid">
          ${fulfillmentRows
            .map(
              (row) => `
          <div class="fulfillment-item">
            <span class="fulfillment-key">${escapeHtml(row.label)}</span>
            <span class="fulfillment-val">${escapeHtml(row.value)}</span>
          </div>`
            )
            .join('')}
        </div>
      </div>`
      : '';

  // -- Social handles (with icons & smart grouping) --
  const social = merchant.social_media;
  const socialIcons: Record<string, string> = {
    instagram:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E4405F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    twitter:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="#000000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    tiktok:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="#000000"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.71a8.28 8.28 0 0 0 4.76 1.5v-3.4a4.85 4.85 0 0 1-1-.12z"/></svg>',
    facebook:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
  };
  // Build entries: { platform, handle }
  const socialEntries: Array<{ platform: string; handle: string }> = [];
  const instagramHandle = normalizeSocialHandle('instagram', social?.instagram);
  const facebookHandle = normalizeSocialHandle('facebook', social?.facebook);
  const twitterHandle = normalizeSocialHandle('twitter', social?.twitter);
  const tiktokHandle = normalizeSocialHandle('tiktok', social?.tiktok);
  if (instagramHandle)
    socialEntries.push({ platform: 'instagram', handle: instagramHandle });
  if (facebookHandle)
    socialEntries.push({ platform: 'facebook', handle: facebookHandle });
  if (twitterHandle)
    socialEntries.push({ platform: 'twitter', handle: twitterHandle });
  if (tiktokHandle)
    socialEntries.push({ platform: 'tiktok', handle: tiktokHandle });

  // Group by handle — if multiple platforms share the same handle, combine icons
  const socialItems: string[] = [];
  if (socialEntries.length > 0) {
    const grouped = new Map<string, string[]>();
    for (const entry of socialEntries) {
      const key = entry.handle.toLowerCase().replace(/^@/, '');
      const existing = grouped.get(key);
      if (existing) {
        existing.push(entry.platform);
      } else {
        grouped.set(key, [entry.platform]);
      }
    }
    for (const [handle, platforms] of grouped) {
      const icons = platforms
        .map((p) => `<span class="footer-icon">${socialIcons[p]}</span>`)
        .join('');
      socialItems.push(
        `<span class="footer-item">${icons}<span>@${escapeHtml(handle)}</span></span>`
      );
    }
  }

  // -- Terms & conditions --
  let termsHtml = '';
  const rawTerms = merchant.pages?.terms;
  if (rawTerms) {
    // Strip HTML tags and decode common entities to get plain text
    const plainTerms = rawTerms
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    if (plainTerms.length > 0) {
      // Truncate to ~500 chars for receipt readability
      const truncated =
        plainTerms.length > 500 ? `${plainTerms.slice(0, 497)}...` : plainTerms;
      const termsLink = options.storeUrl
        ? ` <a href="https://${escapeHtml(options.storeUrl)}/terms">Read full terms</a>`
        : '';
      termsHtml = `<div class="terms-block"><div class="terms-label">Terms &amp; Conditions</div><div class="terms-text">${escapeHtml(truncated)}</div>${termsLink ? `<div class="terms-link">${termsLink}</div>` : ''}</div>`;
    }
  } else if (options.storeUrl) {
    termsHtml = `<div class="terms"><a href="https://${escapeHtml(options.storeUrl)}/terms">Terms &amp; Conditions</a></div>`;
  }

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
  .logo-img { max-height: 48px; max-width: 140px; object-fit: contain; display: block; }
  .logo-svg svg { max-height: 48px; max-width: 140px; width: auto; height: auto; display: block; }
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
  .fulfillment-grid { display: flex; flex-wrap: wrap; gap: 10px; }
  .fulfillment-item { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #e5e7eb; border-radius: 6px; background: #f9fafb; padding: 7px 10px; }
  .fulfillment-key { font-size: 9px; font-weight: 800; color: ${brandPrimary}; text-transform: uppercase; letter-spacing: 0.6px; }
  .fulfillment-val { font-family: 'SF Mono', Menlo, Monaco, monospace; font-size: 11px; font-weight: 700; color: #111827; }

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
  .footer-area { margin-top: auto; padding-top: 14px; text-align: center; }
  .footer-row { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; font-size: 11px; color: #6b7280; margin-bottom: 6px; }
  .footer-row a { color: ${brandPrimary}; text-decoration: none; font-weight: 600; }
  .footer-item { display: inline-flex; align-items: center; gap: 3px; }
  .footer-icon { display: inline-flex; align-items: center; }
  .footer-email-icon { display: inline-flex; align-items: center; color: ${brandPrimary}; }
  .footer-sep { color: #d1d5db; margin: 0 2px; }
  .terms { font-size: 10px; color: #6b7280; margin-bottom: 6px; }
  .terms a { color: ${brandPrimary}; text-decoration: none; font-weight: 600; }
  .terms-block { margin: 10px 0 8px; padding: 10px 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; text-align: left; }
  .terms-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #374151; margin-bottom: 4px; }
  .terms-text { font-size: 9px; color: #6b7280; line-height: 1.5; }
  .terms-link { font-size: 9px; margin-top: 4px; }
  .terms-link a { color: ${brandPrimary}; text-decoration: none; font-weight: 600; }
  .powered { font-size: 11px; color: ${brandPrimary}; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; margin-top: 14px; padding-top: 10px; border-top: 1px solid ${brandCardBorder}; }
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
          ${merchant.tax_identification_number ? `<div><strong>TIN: ${escapeHtml(merchant.tax_identification_number)}</strong></div>` : ''}
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

    <!-- Fulfillment Details -->
    ${fulfillmentDetailsHtml}

    <!-- Payment History -->
    ${paymentHistoryHtml}

    <!-- Bank Details -->
    ${bankDetailsHtml}

    <!-- QR Code -->
    ${qrHtml}

    <!-- Footer -->
    <div class="footer-area">
      ${termsHtml}
      ${(() => {
        const allItems: string[] = [];
        if (contactEmail) {
          allItems.push(
            `<span class="footer-item"><span class="footer-email-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></span><a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a></span>`
          );
        }
        allItems.push(...socialItems);
        if (merchant.cac_rc_number) {
          allItems.push(
            `<span class="footer-item">RC: ${escapeHtml(merchant.cac_rc_number)}</span>`
          );
        }
        if (merchant.tax_identification_number) {
          allItems.push(
            `<span class="footer-item">TIN: ${escapeHtml(merchant.tax_identification_number)}</span>`
          );
        }
        return allItems.length > 0
          ? `<div class="footer-row">${allItems.join('<span class="footer-sep">&middot;</span>')}</div>`
          : '';
      })()}
      <div class="powered">Powered by Baci &middot; usebaci.com</div>
    </div>

  </div>
</div>
</body>
</html>`;
}

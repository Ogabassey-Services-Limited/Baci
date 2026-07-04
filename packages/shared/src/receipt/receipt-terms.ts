import { sanitizeHtmlToPlainText } from '../lib/sanitize-html-text';
import { escapeHtml } from './escape-html';
import type { ReceiptMerchant, ReceiptOptions } from './types';

function buildTermsUrl(rawStoreUrl: string | undefined): string | null {
  const trimmed = rawStoreUrl?.trim();
  if (!trimmed) {
    return null;
  }

  const hasExplicitScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const hasSchemeLikePrefix = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  const isBareHostWithPort = /^[a-z0-9.-]+:\d+(?:[/?#].*)?$/i.test(trimmed);
  if (hasSchemeLikePrefix && !(hasExplicitScheme || isBareHostWithPort)) {
    return null;
  }

  try {
    const parsed = new URL(hasExplicitScheme ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return `${parsed.origin}/terms`;
  } catch {
    return null;
  }
}

export function renderTermsHtml(
  merchant: ReceiptMerchant,
  options: ReceiptOptions
): string {
  const rawTerms = merchant.pages?.terms;
  const termsUrl = buildTermsUrl(options.storeUrl);
  if (termsUrl) {
    return `<div class="terms-block"><div class="terms-label">Terms and Conditions</div><div class="terms-text">By shopping with us, you agree to our terms and conditions and return policies stated below.</div><div class="terms-link"><a href="${escapeHtml(termsUrl)}">${escapeHtml(termsUrl)}</a></div></div>`;
  }

  if (!rawTerms) {
    return '';
  }

  const plainTerms = sanitizeHtmlToPlainText(rawTerms);
  if (!plainTerms) {
    return '';
  }

  const truncated =
    plainTerms.length > 500 ? `${plainTerms.slice(0, 497)}...` : plainTerms;
  return `<div class="terms-block"><div class="terms-label">Terms and Conditions</div><div class="terms-text">${escapeHtml(truncated)}</div></div>`;
}

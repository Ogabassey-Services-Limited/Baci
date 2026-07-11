import type { RepairQuoteSummary } from '@baci/shared/repairs';

/**
 * Display helpers for repair quotes. The catalogue prices are "from" prices
 * ("From ₦25,000") unless a quote is marked as an exact price — the same
 * copy convention the web storefront device pages use.
 */
export function formatRepairNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString('en-US')}`;
}

export function formatQuotePrice(quote: RepairQuoteSummary): string {
  const price = formatRepairNaira(quote.price);
  return quote.isFromPrice ? `From ${price}` : price;
}

/**
 * Compact secondary line for a quote: part quality, turnaround and warranty,
 * dot-separated. Returns null when the quote has none of them so the caller
 * can skip rendering an empty row.
 */
export function quoteMetaLabel(quote: RepairQuoteSummary): string | null {
  const parts: string[] = [];
  if (quote.partQuality) {
    parts.push(quote.partQuality);
  }
  if (quote.turnaround) {
    parts.push(quote.turnaround);
  }
  if (typeof quote.warrantyDays === 'number' && quote.warrantyDays > 0) {
    // "N-day warranty" reads correctly for any N (compound-adjective form).
    parts.push(`${quote.warrantyDays}-day warranty`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

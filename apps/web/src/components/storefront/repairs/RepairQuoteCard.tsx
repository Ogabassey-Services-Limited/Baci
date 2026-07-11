import type { RepairQuoteSummary } from '@baci/shared/repairs';
import type { Route } from 'next';
import Link from 'next/link';
import { formatDisplayCurrency } from '@/lib/format-display-currency';

interface RepairQuoteCardProps {
  quote: RepairQuoteSummary;
  bookHref: Route;
  currency: string;
}

/**
 * A single repair quote for a device: service name, price, optional
 * part-quality/turnaround/warranty details, and a "Book this repair" CTA
 * into the booking wizard (prefilled via device/quote query params).
 */
export function RepairQuoteCard({
  bookHref,
  currency,
  quote,
}: RepairQuoteCardProps) {
  const priceLabel = `${quote.isFromPrice ? 'From ' : ''}${formatDisplayCurrency(quote.price, currency, { minimumFractionDigits: 0 })}`;

  return (
    <div className="rounded-2xl border border-store-border bg-store-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-store-background-text">
            {quote.serviceTypeName}
          </h3>
          {quote.description && (
            <p className="mt-1 text-sm text-store-background-text/60">
              {quote.description}
            </p>
          )}
        </div>
        <span className="whitespace-nowrap text-lg font-bold text-store-primary">
          {priceLabel}
        </span>
      </div>

      {(quote.partQuality || quote.turnaround || quote.warrantyDays) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {quote.partQuality && (
            <span className="rounded-full bg-store-secondary px-2.5 py-1 text-xs font-medium text-store-secondary-text">
              {quote.partQuality}
            </span>
          )}
          {quote.turnaround && (
            <span className="rounded-full bg-store-secondary px-2.5 py-1 text-xs font-medium text-store-secondary-text">
              {quote.turnaround}
            </span>
          )}
          {quote.warrantyDays != null && (
            <span className="rounded-full bg-store-secondary px-2.5 py-1 text-xs font-medium text-store-secondary-text">
              {quote.warrantyDays}-day warranty
            </span>
          )}
        </div>
      )}

      <Link
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-store-primary px-4 py-2 text-sm font-semibold text-store-primary-text transition-colors hover:bg-store-primary/90"
        href={bookHref}
      >
        Book this repair
      </Link>
    </div>
  );
}

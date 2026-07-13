import { Check, ShieldCheck } from 'lucide-react';

const TRUST_ROW_ITEMS = [
  'Instant Results',
  'Official Database',
  '100% Accurate',
] as const;

/** Static hero/trust-pill copy block. Verbatim from the original entry.tsx — preserved for SEO/conversion. */
export function ImeiCheckerHero() {
  return (
    <div className="mx-auto mb-8 max-w-3xl text-center">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--store-primary)]/10 bg-[var(--store-primary)]/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--store-primary)]">
        <ShieldCheck size={14} />
        Trusted by 10,000+ Buyers
      </div>
      <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
        Don't Get Scammed.
        <br />
        <span className="text-[var(--store-primary)]">Verify First.</span>
      </h1>
      <p className="mx-auto mb-4 max-w-xl text-lg leading-relaxed text-gray-600">
        That "Brand New" iPhone might be{' '}
        <span className="font-semibold text-gray-900">
          stolen, iCloud locked, or refurbished
        </span>
        . One quick check can save you from losing ₦500,000+.
      </p>
      <div className="mb-8 flex items-center justify-center gap-6 text-sm text-gray-500">
        {TRUST_ROW_ITEMS.map((label) => (
          <div className="flex items-center gap-1.5" key={label}>
            <Check
              className="text-[var(--store-success-text,#16a34a)]"
              size={16}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

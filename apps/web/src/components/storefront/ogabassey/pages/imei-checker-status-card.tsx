import type { ImeiResultStatusCard } from './imei-checker-status-cards';
import { IMEI_TONES } from './imei-checker-tone';

/** One result detail card: icon, label, and value, colored by the card's resolved tone. */
export function ImeiCheckerStatusCard({
  icon: Icon,
  label,
  toneKey,
  value,
}: ImeiResultStatusCard) {
  const tone = IMEI_TONES[toneKey];

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-[var(--store-border,#f3f4f6)] bg-[var(--store-muted-surface,#f9fafb)] p-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.icon}`}
      >
        <Icon size={20} />
      </div>
      <div>
        <p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-[var(--store-muted-text,#9ca3af)]">
          {label}
        </p>
        <p className={`text-base font-bold ${tone.text}`}>{value}</p>
      </div>
    </div>
  );
}

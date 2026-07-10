export type ImeiToneKey =
  | 'safe'
  | 'danger'
  | 'warning'
  | 'accent'
  | 'primary'
  | 'muted';

export interface ImeiTone {
  surface?: string;
  border?: string;
  icon: string;
  text: string;
}

/**
 * Themed color triples for the IMEI result UI, using the store's CSS-variable
 * vocabulary (with literal fallbacks) so merchant branding flows through.
 * Extracted from imei-results.tsx's original inline resultTones/verdictTone so
 * status cards and the verdict banner share one tone system.
 */
export const IMEI_TONES: Record<ImeiToneKey, ImeiTone> = {
  safe: {
    surface: 'bg-[var(--store-success-bg,#f0fdf4)]',
    border: 'border-[var(--store-success-border,#bbf7d0)]',
    icon: 'bg-[var(--store-success-bg,#dcfce7)] text-[var(--store-success-text,#16a34a)]',
    text: 'text-[var(--store-success-text,#166534)]',
  },
  danger: {
    surface: 'bg-[var(--store-danger-bg,#fef2f2)]',
    border: 'border-[var(--store-danger-border,#fecaca)]',
    icon: 'bg-[var(--store-danger-bg,#fee2e2)] text-[var(--store-danger-text,#dc2626)]',
    text: 'text-[var(--store-danger-text,#dc2626)]',
  },
  warning: {
    surface: 'bg-[var(--store-warning-bg,#fefce8)]',
    border: 'border-[var(--store-warning-border,#fde68a)]',
    icon: 'bg-[var(--store-warning-bg,#fef9c3)] text-[var(--store-warning-text,#854d0e)]',
    text: 'text-[var(--store-warning-text,#854d0e)]',
  },
  accent: {
    icon: 'bg-[var(--store-accent-bg,#eff6ff)] text-[var(--store-accent,#2563eb)]',
    text: 'text-[var(--store-text,#111827)]',
  },
  primary: {
    icon: 'bg-[var(--store-primary)]/10 text-[var(--store-primary)]',
    text: 'text-[var(--store-text,#111827)]',
  },
  muted: {
    icon: 'bg-[var(--store-muted-surface,#f9fafb)] text-[var(--store-muted-text,#6b7280)]',
    text: 'text-[var(--store-text,#111827)]',
  },
};

/** Verdict banner tone: safe/danger map directly, anything else (incl. 'caution') is a warning. */
export function getVerdictTone(
  verdictType: string | null | undefined
): ImeiTone {
  if (verdictType === 'safe') {
    return IMEI_TONES.safe;
  }
  if (verdictType === 'danger') {
    return IMEI_TONES.danger;
  }
  return IMEI_TONES.warning;
}

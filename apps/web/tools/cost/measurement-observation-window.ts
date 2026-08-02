import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal-state';

// Read-token policy verification caps the authority lifetime at 24 hours.
export const MAX_MEASUREMENT_OBSERVATION_LAG_MS = 24 * 60 * 60 * 1000;

export function assertMeasurementObservationWindow(
  journal: Pick<
    CloudflareEvidenceRunJournal,
    'writeTokenRevocationReceipt' | 'cleanupVerifiedAt'
  >,
  observedAt: string | undefined,
  now: Date
) {
  const observedAtMs = observedAt ? new Date(observedAt).valueOf() : Number.NaN;
  const nowMs = now.valueOf();
  const writeRevokedAtMs = journal.writeTokenRevocationReceipt
    ? new Date(journal.writeTokenRevocationReceipt.observedAt).valueOf()
    : Number.NaN;
  const cleanupVerifiedAtMs = journal.cleanupVerifiedAt
    ? new Date(journal.cleanupVerifiedAt).valueOf()
    : Number.NaN;
  const lowerBoundMs = Math.max(writeRevokedAtMs, cleanupVerifiedAtMs);
  if (
    ![observedAtMs, nowMs, lowerBoundMs].every(Number.isFinite) ||
    observedAtMs < lowerBoundMs ||
    observedAtMs > nowMs ||
    nowMs - observedAtMs > MAX_MEASUREMENT_OBSERVATION_LAG_MS
  )
    throw new Error(
      'Cloudflare evidence export observation is outside the active run window'
    );
}

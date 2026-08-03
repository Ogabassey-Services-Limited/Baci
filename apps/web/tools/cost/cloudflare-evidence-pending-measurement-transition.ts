import {
  type CloudflareEvidenceRunJournal,
  isHash,
  validDate,
} from './cloudflare-evidence-run-journal-state';

/** Rejects a phase advance until the reviewed measurement receipt is complete. */
export function assertPendingReadRevocationMeasurement(
  journal: CloudflareEvidenceRunJournal
) {
  if (
    !journal.measurementVerifiedAt ||
    !isHash(journal.measurementReceiptSha256 ?? '') ||
    !isHash(journal.measurementPayloadSha256 ?? '') ||
    !validDate(journal.measurementVerifiedAt)
  )
    throw new Error(
      'pending read-token revocation requires a verified measurement receipt'
    );
}

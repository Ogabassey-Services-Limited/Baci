import type { CloudflareEvidenceRunJournal } from './cloudflare-evidence-run-journal';
import { hasReceipt } from './cloudflare-evidence-run-journal';

export function hasVerifiedCleanupWriteTokenRevocation(
  journal: Pick<
    CloudflareEvidenceRunJournal,
    'cleanupWriteTokenId' | 'cleanupWriteTokenRevocationReceipt'
  >
) {
  const tokenId = journal.cleanupWriteTokenId;
  return (
    tokenId === undefined ||
    (typeof tokenId === 'string' &&
      hasReceipt(journal.cleanupWriteTokenRevocationReceipt, tokenId))
  );
}

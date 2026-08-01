import {
  assertTerminalPrerequisites,
  assertTransition,
  type CleanupVerificationClient,
  type CloudflareEvidenceRunJournal,
  type EvidencePhase,
  isHash,
  type MeasurementReceipt,
  terminal,
  validDate,
} from './cloudflare-evidence-run-journal-state';

export type EvidenceRunTransition = <T>(
  stateDir: string,
  runId: string,
  transition: (journal: CloudflareEvidenceRunJournal) => Promise<T> | T
) => Promise<T>;

export function createEvidenceJournalTransitionOperations(
  transitionJournal: EvidenceRunTransition
) {
  function recordEvidenceMutation(
    stateDir: string,
    runId: string,
    resourceName: string,
    providerId: string
  ) {
    return transitionJournal(stateDir, runId, (journal) => {
      if (
        !['prepared', 'mutated', 'cleanup_incomplete_stop'].includes(
          journal.phase
        )
      )
        throw new Error(
          'resource mutation cannot reopen a verified or terminal run'
        );
      if (!journal.plannedResources.includes(resourceName))
        throw new Error('resource name was not pre-journaled');
      if (!resourceName || !providerId)
        throw new Error('journaled resource identity is invalid');
      if (
        journal.mutations[resourceName] &&
        journal.mutations[resourceName] !== providerId
      )
        throw new Error('journaled resource ID cannot be replaced');
      journal.mutations[resourceName] = providerId;
      journal.phase = 'mutated';
      return journal;
    });
  }

  function recordEvidenceProbeResults(
    stateDir: string,
    runId: string,
    probeResults: readonly string[]
  ) {
    return transitionJournal(stateDir, runId, (journal) => {
      if (
        probeResults.length !== journal.expectedProbeCount ||
        new Set(probeResults).size !== probeResults.length ||
        probeResults.some((result) => !result)
      )
        throw new Error(
          'probe results do not match the expected bounded count'
        );
      if (journal.probeResults.length > 0) {
        if (
          journal.probeResults.length === probeResults.length &&
          journal.probeResults.every(
            (result, index) => result === probeResults[index]
          )
        )
          return journal;
        throw new Error('probe results are append-only and cannot be replaced');
      }
      if (journal.phase !== 'mutated')
        throw new Error('probe results require a mutated run');
      journal.probeResults = [...probeResults];
      return journal;
    });
  }

  function recordEvidencePhase(
    stateDir: string,
    runId: string,
    phase: EvidencePhase,
    details: Partial<
      Pick<
        CloudflareEvidenceRunJournal,
        | 'cleanupAttempts'
        | 'readBackEvidence'
        | 'cleanupIncomplete'
        | 'measurementIncomplete'
      >
    > = {}
  ) {
    return transitionJournal(stateDir, runId, (journal) => {
      if (phase === 'write_token_revoked' || phase === 'read_token_revoked')
        throw new Error('token revocation requires an authenticated receipt');
      if (phase === 'cleanup_verified')
        throw new Error(
          'cleanup verification requires an authenticated receipt'
        );
      if (
        phase === 'cleanup_incomplete_stop' &&
        details.cleanupIncomplete !== true
      )
        throw new Error(
          'incomplete cleanup phase requires incomplete evidence'
        );
      if (
        phase === 'mutated' &&
        journal.phase === 'cleanup_incomplete_stop' &&
        details.cleanupIncomplete === false
      )
        throw new Error('cleanup retry cannot clear incomplete evidence');
      if (
        journal.measurementIncomplete &&
        details.measurementIncomplete === false
      )
        throw new Error(
          'incomplete measurement evidence requires a verified receipt to clear'
        );
      if (
        details.cleanupAttempts !== undefined &&
        (!Number.isInteger(details.cleanupAttempts) ||
          details.cleanupAttempts < journal.cleanupAttempts)
      )
        throw new Error('cleanup attempts must be monotonic');
      Object.assign(journal, details);
      assertTransition(journal, phase);
      if (phase === 'proof_complete' || phase === 'closed_stop')
        assertTerminalPrerequisites(journal, phase);
      journal.phase = phase;
      return journal;
    });
  }

  async function recordCleanupVerified(
    stateDir: string,
    runId: string,
    client: CleanupVerificationClient | unknown
  ) {
    await Promise.resolve();
    if (
      !client ||
      typeof client !== 'object' ||
      typeof (client as CleanupVerificationClient).verifyCleanup !== 'function'
    )
      throw new Error('cleanup verification requires provider readback');
    return transitionJournal(stateDir, runId, async (journal) => {
      if (journal.phase !== 'mutated')
        throw new Error('cleanup verification requires a mutated run');
      if (Object.keys(journal.mutations).length === 0)
        throw new Error('cleanup verification requires a journaled mutation');
      const receipt = await (client as CleanupVerificationClient).verifyCleanup(
        journal.runId,
        journal.preInventorySha256
      );
      if (
        receipt.status !== 'absent' ||
        receipt.inventorySha256 !== journal.preInventorySha256 ||
        !isHash(receipt.providerReceiptSha256) ||
        !validDate(receipt.observedAt)
      )
        throw new Error('provider cleanup readback did not verify absence');
      journal.cleanupVerifiedAt = receipt.observedAt;
      journal.cleanupVerificationReceiptSha256 = receipt.providerReceiptSha256;
      journal.phase = 'cleanup_verified';
      return journal;
    });
  }

  function recordEvidenceMeasurement(
    stateDir: string,
    runId: string,
    receipt: MeasurementReceipt
  ) {
    return transitionJournal(stateDir, runId, (journal) => {
      if (
        !isHash(receipt.providerReceiptSha256) ||
        !validDate(receipt.observedAt)
      )
        throw new Error('measurement receipt is invalid');
      if (journal.measurementReceiptSha256 || journal.measurementVerifiedAt) {
        if (
          journal.measurementReceiptSha256 === receipt.providerReceiptSha256 &&
          journal.measurementVerifiedAt === receipt.observedAt
        )
          return journal;
        throw new Error(
          'measurement receipt is append-only and cannot be replaced'
        );
      }
      if (journal.measurementIncomplete)
        throw new Error(
          'incomplete measurement evidence requires read-token revocation'
        );
      if (journal.phase !== 'write_token_revoked')
        throw new Error('measurement requires write-token revocation');
      journal.measurementVerifiedAt = receipt.observedAt;
      journal.measurementReceiptSha256 = receipt.providerReceiptSha256;
      journal.measurementIncomplete = false;
      return journal;
    });
  }

  function recordEvidenceMeasurementFailure(stateDir: string, runId: string) {
    return transitionJournal(stateDir, runId, (journal) => {
      if (journal.phase !== 'write_token_revoked')
        throw new Error('measurement failure requires write-token revocation');
      if (journal.measurementReceiptSha256 || journal.measurementVerifiedAt)
        throw new Error(
          'measurement failure cannot replace a recorded receipt'
        );
      journal.measurementIncomplete = true;
      if (
        !journal.readBackEvidence.includes(
          'measurement evidence incomplete; STOP'
        )
      )
        journal.readBackEvidence = [
          ...journal.readBackEvidence,
          'measurement evidence incomplete; STOP',
        ];
      return journal;
    });
  }

  function recordCleanupWriteToken(
    stateDir: string,
    runId: string,
    tokenId: string
  ) {
    return transitionJournal(stateDir, runId, (journal) => {
      if (terminal.has(journal.phase))
        throw new Error(
          'cleanup replacement token cannot be recorded for a terminal run'
        );
      if (
        !tokenId ||
        tokenId === journal.writeTokenId ||
        tokenId === journal.readTokenId
      )
        throw new Error(
          'cleanup replacement token must be distinct from run tokens'
        );
      if (
        journal.cleanupWriteTokenId &&
        journal.cleanupWriteTokenId !== tokenId &&
        !journal.cleanupWriteTokenRevocationReceipt
      )
        throw new Error('cleanup replacement token cannot be replaced');
      if (
        journal.cleanupWriteTokenId &&
        journal.cleanupWriteTokenId !== tokenId &&
        journal.cleanupWriteTokenRevocationReceipt
      ) {
        journal.cleanupWriteTokenRevocations = [
          ...(journal.cleanupWriteTokenRevocations ?? []),
          journal.cleanupWriteTokenRevocationReceipt,
        ];
        journal.cleanupWriteTokenRevocationReceipt = undefined;
        journal.cleanupWriteTokenRevokedAt = undefined;
      }
      journal.cleanupWriteTokenId = tokenId;
      return journal;
    });
  }

  return {
    recordEvidenceMeasurement,
    recordEvidenceMeasurementFailure,
    recordEvidenceMutation,
    recordEvidencePhase,
    recordEvidenceProbeResults,
    recordCleanupVerified,
    recordCleanupWriteToken,
  };
}

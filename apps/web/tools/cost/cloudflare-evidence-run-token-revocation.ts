import type {
  CloudflareEvidenceRunJournal,
  TokenRevocationReceipt,
} from './cloudflare-evidence-run-journal';
import {
  assertTerminalPrerequisites,
  assertTransition,
} from './cloudflare-evidence-run-journal-state';

type ReadJournal = (
  stateDir: string,
  runId: string
) => Promise<CloudflareEvidenceRunJournal>;
type TransitionJournal = <T>(
  stateDir: string,
  runId: string,
  transition: (journal: CloudflareEvidenceRunJournal) => Promise<T> | T
) => Promise<T>;
export type TokenRevocationKind = 'write' | 'read' | 'cleanup_write';

export type TokenRevocationClient = Readonly<{
  revoke(
    tokenId: string
  ): Promise<Readonly<{ tokenId: string; auditReceiptSha256: string }>>;
  readBack(tokenId: string): Promise<
    Readonly<{
      tokenId: string;
      status: 'inactive' | 'absent' | 'active';
      auditReceiptSha256: string;
      observedAt: string;
    }>
  >;
}>;

const hash = /^[a-f0-9]{64}$/;

function hasSameReceipt(
  first: TokenRevocationReceipt,
  second: TokenRevocationReceipt
) {
  return (
    first.tokenId === second.tokenId &&
    first.status === second.status &&
    first.providerReceiptSha256 === second.providerReceiptSha256 &&
    first.observedAt === second.observedAt
  );
}

export function createTokenRevocationOperations(
  readJournal: ReadJournal,
  transitionJournal: TransitionJournal
) {
  function expectedTokenId(
    journal: CloudflareEvidenceRunJournal,
    kind: TokenRevocationKind
  ) {
    if (kind === 'write') return journal.writeTokenId;
    if (kind === 'read') return journal.readTokenId;
    if (!journal.cleanupWriteTokenId)
      throw new Error('cleanup replacement token is not journaled');
    return journal.cleanupWriteTokenId;
  }

  function validateRevocationReceipt(
    expected: string,
    receipt: TokenRevocationReceipt
  ) {
    if (
      receipt.tokenId !== expected ||
      receipt.status !== 'revoked' ||
      !hash.test(receipt.providerReceiptSha256) ||
      Number.isNaN(new Date(receipt.observedAt).valueOf())
    )
      throw new Error('token revocation receipt does not match the journal');
  }

  async function applyReceipt(
    journal: CloudflareEvidenceRunJournal,
    kind: TokenRevocationKind,
    receipt: TokenRevocationReceipt,
    client: Pick<TokenRevocationClient, 'readBack'>
  ) {
    validateRevocationReceipt(expectedTokenId(journal, kind), receipt);
    const providerReadBack = await client.readBack(receipt.tokenId);
    if (
      providerReadBack.tokenId !== receipt.tokenId ||
      !['inactive', 'absent'].includes(providerReadBack.status) ||
      providerReadBack.auditReceiptSha256 !== receipt.providerReceiptSha256 ||
      providerReadBack.observedAt !== receipt.observedAt
    )
      throw new Error('serialized token revocation receipt is not verified');

    if (kind === 'write') {
      if (
        journal.phase === 'write_token_revoked' &&
        journal.writeTokenRevocationReceipt
      ) {
        if (!hasSameReceipt(journal.writeTokenRevocationReceipt, receipt))
          throw new Error('write token revocation receipt cannot be replaced');
        return journal;
      }
      if (
        !['cleanup_verified', 'cleanup_incomplete_stop'].includes(journal.phase)
      )
        throw new Error('write token can be revoked only after cleanup');
      assertTransition(journal, 'write_token_revoked');
      journal.writeTokenRevocationReceipt = receipt;
      journal.writeTokenRevokedAt = receipt.observedAt;
      journal.phase = 'write_token_revoked';
    } else if (kind === 'read') {
      if (
        journal.phase === 'read_token_revoked' &&
        journal.readTokenRevocationReceipt
      ) {
        if (!hasSameReceipt(journal.readTokenRevocationReceipt, receipt))
          throw new Error('read token revocation receipt cannot be replaced');
        return journal;
      }
      if (!journal.writeTokenRevocationReceipt)
        throw new Error('write token revocation must be verified first');
      if (
        journal.cleanupWriteTokenId &&
        !journal.cleanupWriteTokenRevocationReceipt
      )
        throw new Error('cleanup replacement token revocation is required');
      const completedMeasurement =
        journal.phase === 'measurement_complete_pending_read_revocation' &&
        !journal.measurementIncomplete &&
        Boolean(
          journal.measurementVerifiedAt &&
            journal.measurementReceiptSha256 &&
            journal.measurementPayloadSha256
        );
      const incompleteMeasurementOrCleanup =
        journal.phase === 'write_token_revoked' &&
        (journal.cleanupIncomplete || journal.measurementIncomplete === true);
      if (!completedMeasurement && !incompleteMeasurementOrCleanup)
        throw new Error(
          'read token revocation requires recorded measurement or terminal incomplete evidence'
        );
      journal.readTokenRevocationReceipt = receipt;
      journal.readTokenRevokedAt = receipt.observedAt;
      if (incompleteMeasurementOrCleanup) {
        assertTransition(journal, 'closed_stop');
        assertTerminalPrerequisites(journal, 'closed_stop');
        journal.phase = 'closed_stop';
      } else {
        assertTransition(journal, 'read_token_revoked');
        journal.phase = 'read_token_revoked';
      }
    } else {
      if (!journal.cleanupWriteTokenId)
        throw new Error('cleanup replacement token is not journaled');
      if (journal.phase === 'proof_complete' || journal.phase === 'closed_stop')
        throw new Error(
          'cleanup replacement token cannot be revoked after a terminal phase'
        );
      if (
        ![
          'mutated',
          'cleanup_incomplete_stop',
          'cleanup_verified',
          'write_token_revoked',
          'read_token_revoked',
        ].includes(journal.phase)
      )
        throw new Error(
          'cleanup replacement token can be revoked only after cleanup'
        );
      journal.cleanupWriteTokenRevocationReceipt = receipt;
      journal.cleanupWriteTokenRevokedAt = receipt.observedAt;
    }
    return journal;
  }

  function recordTokenRevocation(
    stateDir: string,
    runId: string,
    kind: TokenRevocationKind,
    receipt: TokenRevocationReceipt,
    client: Pick<TokenRevocationClient, 'readBack'>
  ) {
    return transitionJournal(stateDir, runId, (journal) =>
      applyReceipt(journal, kind, receipt, client)
    );
  }

  async function revokeEvidenceRunToken(
    stateDir: string,
    runId: string,
    kind: TokenRevocationKind,
    client: TokenRevocationClient
  ) {
    if (kind === 'read')
      throw new Error(
        'read token revocation must be recorded from an external owner receipt'
      );
    const journal = await readJournal(stateDir, runId);
    const tokenId = expectedTokenId(journal, kind);
    const revoked = await client.revoke(tokenId);
    if (revoked.tokenId !== tokenId || !hash.test(revoked.auditReceiptSha256))
      throw new Error('provider revoked the wrong token');
    const readBack = await client.readBack(tokenId);
    if (
      readBack.tokenId !== tokenId ||
      !['inactive', 'absent'].includes(readBack.status) ||
      !hash.test(readBack.auditReceiptSha256) ||
      readBack.auditReceiptSha256 !== revoked.auditReceiptSha256
    )
      throw new Error('provider readback did not verify token revocation');
    const receipt = Object.freeze({
      tokenId,
      status: 'revoked' as const,
      providerReceiptSha256: readBack.auditReceiptSha256,
      observedAt: readBack.observedAt,
    });
    return recordTokenRevocation(stateDir, runId, kind, receipt, client);
  }

  return { recordTokenRevocation, revokeEvidenceRunToken };
}

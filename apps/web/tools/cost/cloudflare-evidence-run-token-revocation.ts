import type {
  CloudflareEvidenceRunJournal,
  TokenRevocationReceipt,
} from './cloudflare-evidence-run-journal';

type ReadJournal = (
  stateDir: string,
  runId: string
) => Promise<CloudflareEvidenceRunJournal>;
type WriteJournal = (
  stateDir: string,
  journal: CloudflareEvidenceRunJournal
) => Promise<void>;
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

export function createTokenRevocationOperations(
  readJournal: ReadJournal,
  writeJournal: WriteJournal,
  transitionJournal?: TransitionJournal
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
      (kind !== 'cleanup_write' &&
        providerReadBack.auditReceiptSha256 !==
          receipt.providerReceiptSha256) ||
      providerReadBack.observedAt !== receipt.observedAt
    )
      throw new Error('serialized token revocation receipt is not verified');

    if (kind === 'write') {
      if (
        journal.phase === 'write_token_revoked' &&
        journal.writeTokenRevocationReceipt
      )
        return journal;
      if (
        !['cleanup_verified', 'cleanup_incomplete_stop'].includes(journal.phase)
      )
        throw new Error('write token can be revoked only after cleanup');
      journal.writeTokenRevocationReceipt = receipt;
      journal.writeTokenRevokedAt = receipt.observedAt;
      journal.phase = 'write_token_revoked';
    } else if (kind === 'read') {
      if (
        journal.phase === 'read_token_revoked' &&
        journal.readTokenRevocationReceipt
      )
        return journal;
      if (journal.phase !== 'write_token_revoked')
        throw new Error('read token revocation requires write revocation');
      if (!journal.writeTokenRevocationReceipt)
        throw new Error('write token revocation must be verified first');
      if (
        journal.cleanupIncomplete &&
        journal.cleanupWriteTokenId &&
        !journal.cleanupWriteTokenRevocationReceipt
      )
        throw new Error('cleanup replacement token revocation is required');
      journal.readTokenRevocationReceipt = receipt;
      journal.readTokenRevokedAt = receipt.observedAt;
      journal.phase = journal.cleanupIncomplete
        ? 'closed_stop'
        : 'read_token_revoked';
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

  async function recordTokenRevocation(
    stateDir: string,
    runId: string,
    kind: TokenRevocationKind,
    receipt: TokenRevocationReceipt,
    client: Pick<TokenRevocationClient, 'readBack'>
  ) {
    if (transitionJournal)
      return transitionJournal(stateDir, runId, (journal) =>
        applyReceipt(journal, kind, receipt, client)
      );
    const journal = await readJournal(stateDir, runId);
    const updated = await applyReceipt(journal, kind, receipt, client);
    await writeJournal(stateDir, updated);
    return updated;
  }

  async function revokeEvidenceRunToken(
    stateDir: string,
    runId: string,
    kind: TokenRevocationKind,
    client: TokenRevocationClient
  ) {
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

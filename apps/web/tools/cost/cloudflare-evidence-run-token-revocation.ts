import type {
  CloudflareEvidenceRunJournal,
  TokenRevocationClient,
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

export function createTokenRevocationOperations(
  readJournal: ReadJournal,
  writeJournal: WriteJournal
) {
  function validateRevocationReceipt(
    expectedTokenId: string,
    receipt: TokenRevocationReceipt
  ) {
    if (
      receipt.tokenId !== expectedTokenId ||
      receipt.status !== 'revoked' ||
      !/^[a-f0-9]{64}$/.test(receipt.providerReceiptSha256) ||
      Number.isNaN(new Date(receipt.observedAt).valueOf())
    )
      throw new Error('token revocation receipt does not match the journal');
  }

  async function recordTokenRevocation(
    stateDir: string,
    runId: string,
    kind: 'write' | 'read',
    receipt: TokenRevocationReceipt,
    client: Pick<TokenRevocationClient, 'readBack'>
  ) {
    const journal = await readJournal(stateDir, runId);
    validateRevocationReceipt(
      kind === 'write' ? journal.writeTokenId : journal.readTokenId,
      receipt
    );
    const providerReadBack = await client.readBack(receipt.tokenId);
    if (
      providerReadBack.tokenId !== receipt.tokenId ||
      !['inactive', 'absent'].includes(providerReadBack.status) ||
      providerReadBack.auditReceiptSha256 !== receipt.providerReceiptSha256 ||
      providerReadBack.observedAt !== receipt.observedAt
    )
      throw new Error('serialized token revocation receipt is not verified');
    if (kind === 'write') {
      journal.writeTokenRevocationReceipt = receipt;
      journal.writeTokenRevokedAt = receipt.observedAt;
      journal.phase = 'write_token_revoked';
    } else {
      if (!journal.writeTokenRevocationReceipt)
        throw new Error('write token revocation must be verified first');
      journal.readTokenRevocationReceipt = receipt;
      journal.readTokenRevokedAt = receipt.observedAt;
      journal.phase = journal.cleanupIncomplete
        ? 'closed_stop'
        : 'read_token_revoked';
    }
    await writeJournal(stateDir, journal);
    return journal;
  }

  async function revokeEvidenceRunToken(
    stateDir: string,
    runId: string,
    kind: 'write' | 'read',
    client: TokenRevocationClient
  ) {
    const journal = await readJournal(stateDir, runId);
    const tokenId =
      kind === 'write' ? journal.writeTokenId : journal.readTokenId;
    const revoked = await client.revoke(tokenId);
    if (
      revoked.tokenId !== tokenId ||
      !/^[a-f0-9]{64}$/.test(revoked.auditReceiptSha256)
    )
      throw new Error('provider revoked the wrong token');
    const readBack = await client.readBack(tokenId);
    if (
      readBack.tokenId !== tokenId ||
      !['inactive', 'absent'].includes(readBack.status) ||
      !/^[a-f0-9]{64}$/.test(readBack.auditReceiptSha256)
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

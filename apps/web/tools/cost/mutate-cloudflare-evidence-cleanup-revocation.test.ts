import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadEvidenceRunForCleanup,
  openEvidenceRun,
  recordCleanupWriteToken,
  recordEvidenceMutation,
  recordEvidencePhase,
} from './cloudflare-evidence-run-journal';
import {
  revokeCleanupWriteTokenIfNeeded,
  revokeWriteTokenIfAvailable,
} from './mutate-cloudflare-evidence-cleanup-support';
import type { EvidenceMutationClient } from './mutate-cloudflare-evidence-support';
import {
  mutationInput,
  mutationResource,
} from './mutate-cloudflare-evidence-test-fixtures';

const receiptHash = 'b'.repeat(64);
const observedAt = '2026-07-31T00:00:00.000Z';

async function createRun() {
  const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
  await chmod(dir, 0o700);
  await openEvidenceRun(dir, mutationInput);
  return dir;
}

function createClient(): EvidenceMutationClient {
  return {
    identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
    findByName: async () => null,
    get: async () => mutationResource,
    create: async () => ({ id: mutationResource.id }),
    probe: async () => [],
    cleanup: async () => true,
    inventorySha256: async () => 'a'.repeat(64),
  };
}

describe('mutation cleanup token revocation', () => {
  it('records cleanup replacement and original write-token revocations', async () => {
    const dir = await createRun();
    await recordEvidenceMutation(
      dir,
      mutationInput.runId,
      mutationResource.name,
      mutationResource.id
    );
    await recordCleanupWriteToken(
      dir,
      mutationInput.runId,
      'replacement-write'
    );
    await recordEvidencePhase(
      dir,
      mutationInput.runId,
      'cleanup_incomplete_stop',
      { cleanupAttempts: 1, cleanupIncomplete: true }
    );
    const client = createClient();
    client.revoke = async (tokenId) => ({
      tokenId,
      auditReceiptSha256: receiptHash,
    });
    client.readBack = async (tokenId) => ({
      tokenId,
      status: 'inactive' as const,
      auditReceiptSha256: receiptHash,
      observedAt,
    });
    await revokeCleanupWriteTokenIfNeeded(
      dir,
      mutationInput.runId,
      'replacement-write',
      client
    );
    expect(
      (await loadEvidenceRunForCleanup(dir, mutationInput.runId))
        .cleanupWriteTokenRevocationReceipt?.tokenId
    ).toBe('replacement-write');

    const originalDir = await createRun();
    await recordEvidenceMutation(
      originalDir,
      mutationInput.runId,
      mutationResource.name,
      mutationResource.id
    );
    await recordEvidencePhase(
      originalDir,
      mutationInput.runId,
      'cleanup_incomplete_stop',
      { cleanupAttempts: 1, cleanupIncomplete: true }
    );
    await expect(
      revokeWriteTokenIfAvailable(originalDir, mutationInput.runId, client)
    ).resolves.toBe(true);
    const journal = await loadEvidenceRunForCleanup(
      originalDir,
      mutationInput.runId
    );
    expect(journal.phase).toBe('write_token_revoked');
    expect(journal.writeTokenRevocationReceipt?.tokenId).toBe(
      mutationInput.writeTokenId
    );
  });
});

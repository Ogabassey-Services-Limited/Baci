import { chmod, mkdtemp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createCleanupVerificationReceipt,
  loadEvidenceRunForCleanup,
  openEvidenceRun,
  recordCleanupVerified,
  recordEvidenceMutation,
  recordEvidencePhase,
  recordTokenRevocation,
  revokeEvidenceRunToken,
} from './cloudflare-evidence-run-journal';

const runId = '0123456789abcdef0123456789abcdef';
const input = {
  runId,
  approvalId: 'approval',
  policyId: 'policy',
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write',
  readTokenId: 'read',
  readPolicySha256: 'c'.repeat(64),
  accountId: 'account',
  zoneId: 'zone',
  plannedResources: ['evidence-run-123-worker'],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
};

async function openedRun() {
  const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
  await chmod(dir, 0o700);
  await openEvidenceRun(dir, input);
  return dir;
}

async function runWithMutation() {
  const dir = await openedRun();
  await recordEvidenceMutation(
    dir,
    input.runId,
    input.plannedResources[0],
    'provider-id'
  );
  return dir;
}

describe('Cloudflare evidence journal security boundaries', () => {
  it('never follows traversal or symlink journal paths', async () => {
    const dir = await openedRun();
    await expect(
      openEvidenceRun(dir, { ...input, runId: '../outside' })
    ).rejects.toThrow('invalid');
    const symlinkDir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(symlinkDir, 0o700);
    await symlink('/tmp', join(symlinkDir, `${runId}.json`));
    await expect(
      loadEvidenceRunForCleanup(symlinkDir, input.runId)
    ).rejects.toThrow('regular');
  });

  it('accepts a serialized revocation receipt only after provider readback re-verifies it', async () => {
    const dir = await runWithMutation();
    await recordCleanupVerified(dir, input.runId, {
      verifyCleanup: async () => ({
        status: 'absent',
        inventorySha256: input.preInventorySha256,
        providerReceiptSha256: 'e'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    });
    await expect(
      recordEvidencePhase(dir, input.runId, 'write_token_revoked')
    ).rejects.toThrow('receipt');
    await expect(
      recordTokenRevocation(
        dir,
        input.runId,
        'write',
        {
          tokenId: 'write',
          status: 'revoked',
          providerReceiptSha256: 'd'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        },
        {
          readBack: async (tokenId) => ({
            tokenId,
            status: 'inactive',
            auditReceiptSha256: 'd'.repeat(64),
            observedAt: '2026-07-31T00:00:00.000Z',
          }),
        }
      )
    ).resolves.toMatchObject({ phase: 'write_token_revoked' });
    await revokeEvidenceRunToken(dir, input.runId, 'write', {
      revoke: async (tokenId) => ({
        tokenId,
        auditReceiptSha256: 'd'.repeat(64),
      }),
      readBack: async (tokenId) => ({
        tokenId,
        status: 'inactive',
        auditReceiptSha256: 'd'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    });
    expect(
      (await loadEvidenceRunForCleanup(dir, input.runId)).writeTokenRevokedAt
    ).toBe('2026-07-31T00:00:00.000Z');
  });

  it('rejects the forgeable cleanup-receipt shape without provider readback', async () => {
    const dir = await runWithMutation();
    const forged = createCleanupVerificationReceipt(
      input.preInventorySha256,
      '2026-07-31T00:00:00.000Z'
    );
    await expect(
      recordCleanupVerified(dir, input.runId, forged)
    ).rejects.toThrow('provider readback');
    await expect(
      recordCleanupVerified(dir, input.runId, {
        verifyCleanup: async () => ({
          status: 'absent',
          inventorySha256: input.preInventorySha256,
          providerReceiptSha256: 'not-a-provider-hash',
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      })
    ).rejects.toThrow('readback');
  });
});

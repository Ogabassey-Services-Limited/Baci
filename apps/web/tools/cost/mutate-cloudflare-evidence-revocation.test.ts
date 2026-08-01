import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  loadEvidenceRunForCleanup,
  openEvidenceRun,
  recordEvidenceMutation,
  recordEvidenceProbeResults,
} from './cloudflare-evidence-run-journal';
import { cleanupCloudflareEvidenceRun } from './mutate-cloudflare-evidence-sources';
import type { ReplacementCapability } from './mutate-cloudflare-evidence-test-fixtures';
import {
  mutationCapability,
  mutationInput,
  mutationResource,
} from './mutate-cloudflare-evidence-test-fixtures';

describe('Cloudflare evidence token revocation lifecycle', () => {
  it('revokes a reviewed replacement cleanup token even when probe evidence is incomplete', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, mutationInput);
    await recordEvidenceMutation(
      dir,
      mutationInput.runId,
      mutationResource.name,
      mutationResource.id
    );
    const replacementCapability: ReplacementCapability = {
      ...mutationCapability,
      tokenId: 'replacement-write',
      policySha256: mutationInput.cleanupPolicySha256,
      replacementForTokenId: mutationInput.writeTokenId,
      cleanupOnly: true,
    };
    let resourcePresent = true;
    const receiptHash = 'f'.repeat(64);
    const result = await cleanupCloudflareEvidenceRun(
      dir,
      mutationInput.runId,
      replacementCapability,
      {
        identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
        findByName: async () => null,
        get: async () => (resourcePresent ? mutationResource : null),
        create: vi.fn(),
        probe: vi.fn(),
        cleanup: async () => {
          resourcePresent = false;
          return true;
        },
        inventorySha256: async () => 'a'.repeat(64),
        revoke: async (tokenId) => ({
          tokenId,
          auditReceiptSha256: receiptHash,
        }),
        readBack: async (tokenId) => ({
          tokenId,
          status: 'inactive' as const,
          auditReceiptSha256: receiptHash,
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      }
    );
    expect(result.phase).toBe('cleanup_incomplete_stop');
    expect(result.cleanupWriteTokenId).toBe('replacement-write');
    expect(result.cleanupWriteTokenRevocationReceipt).toMatchObject({
      tokenId: 'replacement-write',
      providerReceiptSha256: receiptHash,
    });

    const secondReceiptHash = 'c'.repeat(64);
    const secondCapability: ReplacementCapability = {
      ...mutationCapability,
      tokenId: 'replacement-write-2',
      policySha256: mutationInput.cleanupPolicySha256,
      replacementForTokenId: mutationInput.writeTokenId,
      cleanupOnly: true,
    };
    const secondResult = await cleanupCloudflareEvidenceRun(
      dir,
      mutationInput.runId,
      secondCapability,
      {
        identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
        findByName: async () => null,
        get: async () => null,
        create: vi.fn(),
        probe: vi.fn(),
        cleanup: vi.fn(),
        inventorySha256: async () => 'a'.repeat(64),
        revoke: async (tokenId) => ({
          tokenId,
          auditReceiptSha256: secondReceiptHash,
        }),
        readBack: async (tokenId) => ({
          tokenId,
          status: 'absent' as const,
          auditReceiptSha256: secondReceiptHash,
          observedAt: '2026-07-31T00:00:01.000Z',
        }),
      }
    );
    expect(secondResult.cleanupWriteTokenRevocations).toHaveLength(1);
    expect(secondResult.cleanupWriteTokenId).toBe('replacement-write-2');
  });

  it('resumes token revocation after cleanup verification survives a crash', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, mutationInput);
    await recordEvidenceMutation(
      dir,
      mutationInput.runId,
      mutationResource.name,
      mutationResource.id
    );
    await recordEvidenceProbeResults(dir, mutationInput.runId, [
      'probe-a',
      'probe-b',
    ]);
    const revoke = vi
      .fn()
      .mockRejectedValueOnce(new Error('operator process stopped'))
      .mockResolvedValue({
        tokenId: mutationInput.writeTokenId,
        auditReceiptSha256: 'd'.repeat(64),
      });
    const client = {
      identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
      findByName: async () => null,
      get: async () => null,
      create: vi.fn(),
      probe: vi.fn(),
      cleanup: async () => true,
      inventorySha256: async () => 'a'.repeat(64),
      verifyCleanup: async () => ({
        status: 'absent' as const,
        inventorySha256: 'a'.repeat(64),
        providerReceiptSha256: 'e'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
      revoke,
      readBack: async (tokenId: string) => ({
        tokenId,
        status: 'inactive' as const,
        auditReceiptSha256: 'd'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    };
    await expect(
      cleanupCloudflareEvidenceRun(
        dir,
        mutationInput.runId,
        mutationCapability,
        client
      )
    ).rejects.toThrow('operator process stopped');
    expect(
      (await loadEvidenceRunForCleanup(dir, mutationInput.runId)).phase
    ).toBe('cleanup_verified');
    await expect(
      cleanupCloudflareEvidenceRun(
        dir,
        mutationInput.runId,
        mutationCapability,
        client
      )
    ).resolves.toMatchObject({ phase: 'write_token_revoked' });
    expect(revoke).toHaveBeenCalledTimes(2);
  });
});

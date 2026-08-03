import { describe, expect, it, vi } from 'vitest';
import {
  loadEvidenceRunForCleanup,
  openEvidenceRun,
  recordEvidenceMutation,
  recordEvidencePhase,
  recordEvidenceProbeResults,
  recordTokenRevocation,
  revokeEvidenceRunToken,
} from './cloudflare-evidence-run-journal';
import { createCleanupRun } from './mutate-cloudflare-evidence-cleanup.test-support';
import { cleanupCloudflareEvidenceRun } from './mutate-cloudflare-evidence-sources';
import {
  mutationCapability,
  mutationInput,
  mutationResource,
  reviewedProbeResults,
} from './mutate-cloudflare-evidence-test-fixtures';

describe('Cloudflare evidence cleanup lifecycle', () => {
  it('cleanup-only stops incomplete crash recovery without create, probe, or measurement', async () => {
    const dir = await createCleanupRun();
    await recordEvidenceMutation(
      dir,
      mutationInput.runId,
      mutationResource.name,
      mutationResource.id
    );
    const create = vi.fn();
    const probe = vi.fn();
    let resourcePresent = true;
    await expect(
      cleanupCloudflareEvidenceRun(
        dir,
        mutationInput.runId,
        mutationCapability,
        {
          identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
          findByName: async () => null,
          get: async () => (resourcePresent ? mutationResource : null),
          create,
          probe,
          cleanup: async () => {
            resourcePresent = false;
            return true;
          },
          inventorySha256: async () => 'a'.repeat(64),
        }
      )
    ).resolves.toMatchObject({ phase: 'cleanup_incomplete_stop' });
    expect(resourcePresent).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
    await expect(
      openEvidenceRun(dir, {
        ...mutationInput,
        runId: 'abcdef0123456789abcdef0123456789',
      })
    ).rejects.toThrow('active');
    await expect(
      recordEvidencePhase(dir, mutationInput.runId, 'closed_stop')
    ).rejects.toThrow(
      'invalid evidence phase transition: cleanup_incomplete_stop -> closed_stop'
    );

    const revoke = async (tokenId: string) => ({
      tokenId,
      auditReceiptSha256: 'd'.repeat(64),
    });
    await revokeEvidenceRunToken(dir, mutationInput.runId, 'write', {
      revoke,
      readBack: async (tokenId) => ({
        tokenId,
        status: 'inactive',
        auditReceiptSha256: 'd'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    });
    await expect(
      recordEvidencePhase(dir, mutationInput.runId, 'closed_stop')
    ).rejects.toThrow(
      'terminal evidence phase requires verified token revocation'
    );
    await expect(
      recordTokenRevocation(
        dir,
        mutationInput.runId,
        'read',
        {
          tokenId: mutationInput.readTokenId,
          status: 'revoked',
          providerReceiptSha256: 'f'.repeat(64),
          observedAt: '2026-07-31T00:00:01.000Z',
        },
        {
          readBack: async () => ({
            tokenId: 'wrong',
            status: 'inactive',
            auditReceiptSha256: 'e'.repeat(64),
            observedAt: '2026-07-31T00:00:01.000Z',
          }),
        }
      )
    ).rejects.toThrow('serialized token revocation receipt is not verified');
    await expect(
      openEvidenceRun(dir, {
        ...mutationInput,
        runId: 'abcdef0123456789abcdef0123456789',
      })
    ).rejects.toThrow('active');

    await expect(
      recordTokenRevocation(
        dir,
        mutationInput.runId,
        'read',
        {
          tokenId: mutationInput.readTokenId,
          status: 'revoked',
          providerReceiptSha256: 'f'.repeat(64),
          observedAt: '2026-07-31T00:00:02.000Z',
        },
        {
          readBack: async (tokenId) => ({
            tokenId,
            status: 'absent',
            auditReceiptSha256: 'f'.repeat(64),
            observedAt: '2026-07-31T00:00:02.000Z',
          }),
        }
      )
    ).resolves.toMatchObject({ phase: 'closed_stop' });
    await expect(
      openEvidenceRun(dir, {
        ...mutationInput,
        runId: 'abcdef0123456789abcdef0123456789',
        plannedResources: ['baci-evidence-abcdef0123456789abcdef0123456789'],
      })
    ).resolves.toMatchObject({
      runId: 'abcdef0123456789abcdef0123456789',
      phase: 'prepared',
    });
  });

  it('discovers a successful create that was not journaled before cleanup deletes it', async () => {
    const dir = await createCleanupRun();
    let resourcePresent = true;
    const cleanup = vi.fn(async () => {
      resourcePresent = false;
      return true;
    });
    await expect(
      cleanupCloudflareEvidenceRun(
        dir,
        mutationInput.runId,
        mutationCapability,
        {
          identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
          findByName: async () => (resourcePresent ? mutationResource : null),
          get: async () => (resourcePresent ? mutationResource : null),
          create: vi.fn(),
          probe: vi.fn(),
          cleanup,
          inventorySha256: async () => 'a'.repeat(64),
        }
      )
    ).resolves.toMatchObject({ phase: 'cleanup_incomplete_stop' });
    expect(cleanup).toHaveBeenCalledWith(
      mutationResource.name,
      mutationResource.id
    );
    expect(
      (await loadEvidenceRunForCleanup(dir, mutationInput.runId)).mutations
    ).toEqual({ [mutationResource.name]: mutationResource.id });
  });

  it('records write-token revocation after incomplete cleanup when provider readback is available', async () => {
    const dir = await createCleanupRun();
    await recordEvidenceMutation(
      dir,
      mutationInput.runId,
      mutationResource.name,
      mutationResource.id
    );
    let resourcePresent = true;
    const receiptHash = 'f'.repeat(64);
    await expect(
      cleanupCloudflareEvidenceRun(
        dir,
        mutationInput.runId,
        mutationCapability,
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
      )
    ).resolves.toMatchObject({ phase: 'write_token_revoked' });
  });

  it('preflights cleanup readback before deleting a complete run', async () => {
    const dir = await createCleanupRun();
    await recordEvidenceMutation(
      dir,
      mutationInput.runId,
      mutationResource.name,
      mutationResource.id
    );
    await recordEvidenceProbeResults(
      dir,
      mutationInput.runId,
      reviewedProbeResults()
    );
    const cleanup = vi.fn();
    const client = {
      identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
      findByName: async () => null,
      get: async () => mutationResource,
      create: vi.fn(),
      probe: vi.fn(),
      cleanup,
      inventorySha256: async () => 'a'.repeat(64),
    };
    await expect(
      cleanupCloudflareEvidenceRun(
        dir,
        mutationInput.runId,
        mutationCapability,
        client
      )
    ).rejects.toThrow('provider readback');
    expect(cleanup).not.toHaveBeenCalled();
    expect(
      (await loadEvidenceRunForCleanup(dir, mutationInput.runId)).phase
    ).toBe('mutated');
  });

  it('can retry a cleanup whose provider readback failed after deletion', async () => {
    const dir = await createCleanupRun();
    await recordEvidenceMutation(
      dir,
      mutationInput.runId,
      mutationResource.name,
      mutationResource.id
    );
    await recordEvidenceProbeResults(
      dir,
      mutationInput.runId,
      reviewedProbeResults()
    );
    let resourcePresent = true;
    const cleanup = vi.fn(async () => {
      resourcePresent = false;
      return true;
    });
    const verifyCleanup = vi
      .fn()
      .mockRejectedValueOnce(new Error('provider readback unavailable'))
      .mockResolvedValue({
        status: 'absent' as const,
        inventorySha256: 'a'.repeat(64),
        providerReceiptSha256: 'f'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      });
    const client = {
      identity: async () => ({ accountId: 'account', zoneId: 'zone' }),
      findByName: async () => null,
      get: async () => (resourcePresent ? mutationResource : null),
      create: vi.fn(),
      probe: vi.fn(),
      cleanup,
      inventorySha256: async () => 'a'.repeat(64),
      verifyCleanup,
    };
    await expect(
      cleanupCloudflareEvidenceRun(
        dir,
        mutationInput.runId,
        mutationCapability,
        client
      )
    ).rejects.toThrow('provider readback unavailable');
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(
      (await loadEvidenceRunForCleanup(dir, mutationInput.runId)).phase
    ).toBe('mutated');
    await expect(
      cleanupCloudflareEvidenceRun(
        dir,
        mutationInput.runId,
        mutationCapability,
        client
      )
    ).resolves.toMatchObject({ phase: 'cleanup_verified' });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(verifyCleanup).toHaveBeenCalledTimes(2);
  });
});

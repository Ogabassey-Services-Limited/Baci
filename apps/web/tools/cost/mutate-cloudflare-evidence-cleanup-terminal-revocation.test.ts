import { describe, expect, it, vi } from 'vitest';
import {
  openEvidenceRun,
  recordEvidenceMutation,
  recordEvidencePhase,
  recordTokenRevocation,
  revokeEvidenceRunToken,
} from './cloudflare-evidence-run-journal';
import { createCleanupRun } from './mutate-cloudflare-evidence-cleanup.test-support';
import { cleanupCloudflareEvidenceRun } from './mutate-cloudflare-evidence-sources';
import {
  mutationCapability,
  mutationInput,
  mutationResource,
} from './mutate-cloudflare-evidence-test-fixtures';

describe('Cloudflare evidence cleanup terminal revocation', () => {
  it('keeps an incomplete crash recovery active until both run tokens are verified revoked', async () => {
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
});

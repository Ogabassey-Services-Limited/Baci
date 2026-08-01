import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openEvidenceRun,
  recordCleanupVerified,
  recordEvidenceMutation,
  recordEvidenceProbeResults,
  revokeEvidenceRunToken,
} from './cloudflare-evidence-run-journal';
import {
  type EvidenceMeasurementClient,
  measureCloudflareEvidenceSources,
} from './measure-cloudflare-evidence-sources';
import {
  measurementCapability as capability,
  measurementInput as input,
} from './measure-cloudflare-evidence-sources.test-fixtures';

describe('measureCloudflareEvidenceSources revocation', () => {
  beforeEach(() =>
    vi.useFakeTimers({ now: new Date('2026-07-31T00:05:00.000Z') })
  );
  afterEach(() => vi.useRealTimers());

  it('requires verified matching write and read revocation receipts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    await recordEvidenceMutation(
      dir,
      input.runId,
      input.plannedResources[0],
      'resource-id'
    );
    await recordEvidenceProbeResults(dir, input.runId, ['probe-a', 'probe-b']);
    await recordCleanupVerified(dir, input.runId, {
      verifyCleanup: async () => ({
        status: 'absent',
        inventorySha256: input.preInventorySha256,
        providerReceiptSha256: 'f'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    });
    const client: EvidenceMeasurementClient = {
      measure: async () => ({
        complete: true,
        expectedProbeCount: 2,
        observedProbeCount: 2,
        probeResults: ['probe-a', 'probe-b'],
        providerReceiptSha256: 'a'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
      revoke: async (tokenId) => ({
        tokenId,
        auditReceiptSha256: 'c'.repeat(64),
      }),
      readBack: async () => ({
        tokenId: 'wrong',
        status: 'inactive',
        auditReceiptSha256: 'c'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    };
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, client)
    ).rejects.toThrow('write');
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
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, {
        ...client,
        measure: async () => ({
          complete: true,
          expectedProbeCount: 2,
          observedProbeCount: 2,
          probeResults: ['probe-a', 'unrelated-probe'],
          providerReceiptSha256: 'a'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
        revoke: async (tokenId) => ({
          tokenId,
          auditReceiptSha256: 'e'.repeat(64),
        }),
        readBack: async (tokenId) => ({
          tokenId,
          status: 'inactive',
          auditReceiptSha256: 'e'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      })
    ).rejects.toThrow('incomplete');
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, client)
    ).rejects.toThrow('readback');
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, {
        ...client,
        revoke: async (tokenId) => ({
          tokenId,
          auditReceiptSha256: 'e'.repeat(64),
        }),
        readBack: async (tokenId) => ({
          tokenId,
          status: 'inactive',
          auditReceiptSha256: 'e'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      })
    ).resolves.toMatchObject({ phase: 'proof_complete' });
  });
});

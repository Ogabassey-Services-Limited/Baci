import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openEvidenceRun,
  recordCleanupVerified,
  recordCleanupWriteToken,
  recordEvidenceMeasurementFailure,
  recordEvidenceMutation,
  recordEvidenceProbeResults,
  revokeEvidenceRunToken,
} from './cloudflare-evidence-run-journal';
import {
  type EvidenceMeasurementClient,
  measureCloudflareEvidenceSources,
  revokeCloudflareEvidenceReadToken,
} from './measure-cloudflare-evidence-sources';
import {
  measurementCapability as capability,
  measurementInput as input,
} from './measure-cloudflare-evidence-sources.test-fixtures';

const observedAt = '2026-07-31T00:00:00.000Z';

function createMeasurementClient(): EvidenceMeasurementClient {
  return {
    measure: vi.fn(async () => ({
      complete: true,
      expectedProbeCount: input.expectedProbeCount,
      observedProbeCount: input.expectedProbeCount,
      probeResults: ['probe-a', 'probe-b'],
      providerReceiptSha256: 'a'.repeat(64),
      observedAt,
    })),
    revoke: vi.fn(async (tokenId: string) => ({
      tokenId,
      auditReceiptSha256: 'd'.repeat(64),
    })),
    readBack: vi.fn(async (tokenId: string) => ({
      tokenId,
      status: 'inactive' as const,
      auditReceiptSha256: 'd'.repeat(64),
      observedAt,
    })),
  };
}

async function createRunWithUnrevokedCleanupWriteToken() {
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
  await recordCleanupWriteToken(dir, input.runId, 'replacement-write');
  await recordCleanupVerified(dir, input.runId, {
    verifyCleanup: async () => ({
      status: 'absent',
      inventorySha256: input.preInventorySha256,
      providerReceiptSha256: 'f'.repeat(64),
      observedAt,
    }),
  });
  await revokeEvidenceRunToken(
    dir,
    input.runId,
    'write',
    createMeasurementClient()
  );
  return dir;
}

describe('measureCloudflareEvidenceSources revocation', () => {
  beforeEach(() =>
    vi.useFakeTimers({ now: new Date('2026-07-31T00:05:00.000Z') })
  );
  afterEach(() => vi.useRealTimers());

  it('blocks measurement until a journaled cleanup replacement token is verified revoked', async () => {
    const dir = await createRunWithUnrevokedCleanupWriteToken();
    const client = createMeasurementClient();

    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, client)
    ).rejects.toThrow('write process must exit, clean up, and revoke');
    expect(client.measure).not.toHaveBeenCalled();

    await revokeEvidenceRunToken(dir, input.runId, 'cleanup_write', client);
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, client)
    ).resolves.toMatchObject({ phase: 'proof_complete' });
  });

  it('blocks read-token revocation until a journaled cleanup replacement token is verified revoked', async () => {
    const dir = await createRunWithUnrevokedCleanupWriteToken();
    await recordEvidenceMeasurementFailure(dir, input.runId);
    const client = createMeasurementClient();

    await expect(
      revokeCloudflareEvidenceReadToken(dir, input.runId, capability, client)
    ).rejects.toThrow(
      'read-token revocation requires a write-revoked incomplete run'
    );
    expect(client.revoke).not.toHaveBeenCalled();

    await revokeEvidenceRunToken(dir, input.runId, 'cleanup_write', client);
    await expect(
      revokeCloudflareEvidenceReadToken(dir, input.runId, capability, client)
    ).resolves.toMatchObject({ phase: 'closed_stop' });
  });

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
    ).rejects.toThrow('terminal');
    await expect(
      revokeCloudflareEvidenceReadToken(dir, input.runId, capability, {
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
    ).resolves.toMatchObject({ phase: 'closed_stop' });
  });
});

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
import { recordCloudflareEvidenceReadTokenRevocation } from './measure-cloudflare-evidence-read-revocation';
import { measureCloudflareEvidenceSources } from './measure-cloudflare-evidence-sources';
import {
  measurementCapability as capability,
  measurementInput as input,
} from './measure-cloudflare-evidence-sources.test-fixtures';
import { REVIEWED_PROBE_CASE_IDS } from './mutate-cloudflare-evidence-probes';
import {
  externalReadTokenRevocationDependencies,
  reviewedProbeResults,
} from './mutate-cloudflare-evidence-test-fixtures';

const observedAt = '2026-07-31T00:00:00.000Z';

function createMeasurementClient() {
  return {
    measure: vi.fn(async () => ({
      complete: true,
      expectedProbeCount: input.expectedProbeCount,
      observedProbeCount: input.expectedProbeCount,
      probeResults: [...REVIEWED_PROBE_CASE_IDS],
      providerReceiptSha256: 'a'.repeat(64),
      payloadSha256: 'b'.repeat(64),
      observedAt,
    })),
  };
}

function createWriteRevocationClient() {
  return {
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
  await recordEvidenceProbeResults(
    dir,
    input.runId,
    reviewedProbeResults(input.runId)
  );
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
    createWriteRevocationClient()
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

    await revokeEvidenceRunToken(
      dir,
      input.runId,
      'cleanup_write',
      createWriteRevocationClient()
    );
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, client)
    ).resolves.toMatchObject({
      phase: 'measurement_complete_pending_read_revocation',
    });
    await expect(
      recordCloudflareEvidenceReadTokenRevocation(
        dir,
        input.runId,
        externalReadTokenRevocationDependencies(
          input.readTokenId,
          '2026-07-31T00:00:01.000Z'
        )
      )
    ).resolves.toMatchObject({ phase: 'proof_complete' });
  });

  it('blocks an external read-token receipt until a cleanup replacement token is verified revoked', async () => {
    const dir = await createRunWithUnrevokedCleanupWriteToken();
    await recordEvidenceMeasurementFailure(dir, input.runId);

    await expect(
      recordCloudflareEvidenceReadTokenRevocation(
        dir,
        input.runId,
        externalReadTokenRevocationDependencies(
          input.readTokenId,
          '2026-07-31T00:00:01.000Z'
        )
      )
    ).rejects.toThrow('cleanup replacement token revocation is required');

    await revokeEvidenceRunToken(
      dir,
      input.runId,
      'cleanup_write',
      createWriteRevocationClient()
    );
    await expect(
      recordCloudflareEvidenceReadTokenRevocation(
        dir,
        input.runId,
        externalReadTokenRevocationDependencies(
          input.readTokenId,
          '2026-07-31T00:00:01.000Z'
        )
      )
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
    await recordEvidenceProbeResults(
      dir,
      input.runId,
      reviewedProbeResults(input.runId)
    );
    await recordCleanupVerified(dir, input.runId, {
      verifyCleanup: async () => ({
        status: 'absent',
        inventorySha256: input.preInventorySha256,
        providerReceiptSha256: 'f'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    });
    const client = {
      measure: async () => ({
        complete: true,
        expectedProbeCount: 2,
        observedProbeCount: 2,
        probeResults: [...REVIEWED_PROBE_CASE_IDS],
        providerReceiptSha256: 'a'.repeat(64),
        payloadSha256: 'b'.repeat(64),
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
          payloadSha256: 'b'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      })
    ).rejects.toThrow('incomplete');
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, client)
    ).rejects.toThrow('terminal');
    await expect(
      recordCloudflareEvidenceReadTokenRevocation(
        dir,
        input.runId,
        externalReadTokenRevocationDependencies(
          input.readTokenId,
          '2026-07-31T00:00:01.000Z'
        )
      )
    ).resolves.toMatchObject({ phase: 'closed_stop' });
  });
});

import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  openEvidenceRun,
  recordCleanupVerified,
  recordEvidenceMeasurementFailure,
  recordEvidenceMutation,
  recordEvidenceProbeResults,
  revokeEvidenceRunToken,
} from './cloudflare-evidence-run-journal';
import type { EvidenceMeasurementClient } from './measure-cloudflare-evidence-sources';
import { measureCloudflareEvidenceSources } from './measure-cloudflare-evidence-sources';
import {
  measurementCapability as capability,
  measurementInput as input,
} from './measure-cloudflare-evidence-sources.test-fixtures';
import { REVIEWED_PROBE_CASE_IDS } from './mutate-cloudflare-evidence-probes';
import { reviewedProbeResults } from './mutate-cloudflare-evidence-test-fixtures';

describe('measureCloudflareEvidenceSources', () => {
  beforeEach(() =>
    vi.useFakeTimers({
      now: new Date('2026-07-31T00:05:00.000Z'),
      toFake: ['Date'],
    })
  );
  afterEach(() => vi.useRealTimers());
  it('rejects a measurement that reports a client-controlled probe count', async () => {
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
    const revoke = async (tokenId: string) => ({
      tokenId,
      auditReceiptSha256: 'd'.repeat(64),
    });
    await revokeEvidenceRunToken(dir, input.runId, 'write', {
      revoke,
      readBack: async (tokenId) => ({
        tokenId,
        status: 'inactive' as const,
        auditReceiptSha256: 'd'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    });
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, {
        measure: async () => ({
          complete: true,
          expectedProbeCount: 1,
          observedProbeCount: 1,
          probeResults: [...REVIEWED_PROBE_CASE_IDS],
          providerReceiptSha256: 'a'.repeat(64),
          payloadSha256: 'b'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      })
    ).rejects.toThrow('incomplete');
  });
  it('rejects a measurement without an authenticated provider receipt instead of fabricating one', async () => {
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
    const missingReceiptResult = {
      complete: true,
      expectedProbeCount: input.expectedProbeCount,
      observedProbeCount: input.expectedProbeCount,
      probeResults: [...REVIEWED_PROBE_CASE_IDS],
      observedAt: '2026-07-31T00:00:00.000Z',
    } as unknown as Awaited<ReturnType<EvidenceMeasurementClient['measure']>>;
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, {
        measure: async () => missingReceiptResult,
      })
    ).rejects.toThrow('receipt');
  });
  it('records a measurement without invoking read-token revocation authority', async () => {
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
    const measure = vi.fn(async () => ({
      complete: true,
      expectedProbeCount: 2,
      observedProbeCount: 2,
      probeResults: [...REVIEWED_PROBE_CASE_IDS],
      providerReceiptSha256: 'a'.repeat(64),
      payloadSha256: 'b'.repeat(64),
      observedAt: '2026-07-31T00:00:00.000Z',
    }));
    const revoke = vi.fn();
    const client = {
      measure,
      revoke,
    };
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, client)
    ).resolves.toMatchObject({
      phase: 'measurement_complete_pending_read_revocation',
    });
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, client)
    ).resolves.toMatchObject({
      phase: 'measurement_complete_pending_read_revocation',
    });
    expect(measure).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();
  });

  it('does not retry a run after measurement evidence is marked terminal', async () => {
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
    await revokeEvidenceRunToken(dir, input.runId, 'write', {
      revoke: async (tokenId) => ({
        tokenId,
        auditReceiptSha256: 'd'.repeat(64),
      }),
      readBack: async (tokenId) => ({
        tokenId,
        status: 'inactive' as const,
        auditReceiptSha256: 'd'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    });
    await recordEvidenceMeasurementFailure(dir, input.runId);
    const measure = vi.fn(async () => {
      throw new Error('measurement should not retry');
    });
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, {
        measure,
      })
    ).rejects.toThrow('terminal');
    expect(measure).not.toHaveBeenCalled();
  });
});

import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  openEvidenceRun,
  recordCleanupVerified,
  recordEvidenceMutation,
  recordEvidenceProbeResults,
  revokeEvidenceRunToken,
} from './cloudflare-evidence-run-journal';
import type { EvidenceMeasurementClient } from './measure-cloudflare-evidence-sources';
import {
  measureCloudflareEvidenceSources,
  parseMeasurementArguments,
} from './measure-cloudflare-evidence-sources';

describe('parseMeasurementArguments', () => {
  it('requires a fresh read-only measurement run and has no apply mode', () => {
    expect(
      parseMeasurementArguments(['--run', '0123456789abcdef0123456789abcdef'])
        .runId
    ).toBe('0123456789abcdef0123456789abcdef');
    expect(() =>
      parseMeasurementArguments([
        '--run',
        '0123456789abcdef0123456789abcdef',
        '--apply',
      ])
    ).toThrow('read-only');
  });
});

const input = {
  runId: '0123456789abcdef0123456789abcdef',
  approvalId: 'approval',
  policyId: 'policy',
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write',
  readTokenId: 'read',
  accountId: 'account',
  zoneId: 'zone',
  plannedResources: ['baci-evidence-0123456789abcdef0123456789abcdef'],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
};
const capability = {
  ...input,
  tokenId: 'read',
  permissionGroupIds: ['analytics.read'],
  resources: ['account'],
  expiresAt: '2026-08-01T00:00:00.000Z',
  policySha256: 'b'.repeat(64),
  kind: 'read' as const,
  providerNegativeScopeUnverified: true as const,
};

describe('measureCloudflareEvidenceSources', () => {
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
    const client = {
      measure: async () => ({
        complete: true,
        expectedProbeCount: 2,
        observedProbeCount: 2,
        providerReceiptSha256: 'a'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
      revoke: async (tokenId: string) => ({
        tokenId,
        auditReceiptSha256: 'c'.repeat(64),
      }),
      readBack: async () => ({
        tokenId: 'wrong',
        status: 'inactive' as const,
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
      measureCloudflareEvidenceSources(dir, input.runId, capability, client)
    ).rejects.toThrow('readback');
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, {
        ...client,
        revoke: async (tokenId: string) => ({
          tokenId,
          auditReceiptSha256: 'e'.repeat(64),
        }),
        readBack: async () => ({
          tokenId: 'read',
          status: 'inactive' as const,
          auditReceiptSha256: 'e'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      })
    ).resolves.toMatchObject({ phase: 'proof_complete' });
  });
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
    await recordEvidenceProbeResults(dir, input.runId, ['probe-a', 'probe-b']);
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
          providerReceiptSha256: 'a'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
        revoke,
        readBack: async (tokenId) => ({
          tokenId,
          status: 'inactive' as const,
          auditReceiptSha256: 'e'.repeat(64),
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
    await recordEvidenceProbeResults(dir, input.runId, ['probe-a', 'probe-b']);
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
      observedAt: '2026-07-31T00:00:00.000Z',
    } as unknown as Awaited<ReturnType<EvidenceMeasurementClient['measure']>>;
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, {
        measure: async () => missingReceiptResult,
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
    ).rejects.toThrow('receipt');
  });

  it('resumes read-token revocation from an already recorded measurement', async () => {
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
      providerReceiptSha256: 'a'.repeat(64),
      observedAt: '2026-07-31T00:00:00.000Z',
    }));
    const revoke = vi
      .fn()
      .mockRejectedValueOnce(new Error('read revoke interrupted'))
      .mockResolvedValue({
        tokenId: 'read',
        auditReceiptSha256: 'e'.repeat(64),
      });
    const client = {
      measure,
      revoke,
      readBack: async (tokenId: string) => ({
        tokenId,
        status: 'inactive' as const,
        auditReceiptSha256: 'e'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    };
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, client)
    ).rejects.toThrow('read revoke interrupted');
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, client)
    ).resolves.toMatchObject({ phase: 'proof_complete' });
    expect(measure).toHaveBeenCalledTimes(1);
  });
});

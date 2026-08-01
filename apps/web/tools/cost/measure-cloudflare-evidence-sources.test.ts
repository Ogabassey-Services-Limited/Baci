import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createCleanupVerificationReceipt,
  openEvidenceRun,
  recordCleanupVerified,
  recordEvidenceMutation,
  revokeEvidenceRunToken,
} from './cloudflare-evidence-run-journal';
import {
  measureCloudflareEvidenceSources,
  parseMeasurementArguments,
} from './measure-cloudflare-evidence-sources';

describe('parseMeasurementArguments', () => {
  it('requires a fresh read-only measurement run and has no apply mode', () => {
    expect(parseMeasurementArguments(['--run', 'run-123']).runId).toBe(
      'run-123'
    );
    expect(() =>
      parseMeasurementArguments(['--run', 'run-123', '--apply'])
    ).toThrow('read-only');
  });
});

const input = {
  runId: 'run-123',
  approvalId: 'approval',
  policyId: 'policy',
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write',
  readTokenId: 'read',
  accountId: 'account',
  zoneId: 'zone',
  plannedResources: ['baci-evidence-run-123'],
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
    await recordCleanupVerified(
      dir,
      input.runId,
      createCleanupVerificationReceipt(
        input.preInventorySha256,
        '2026-07-31T00:00:00.000Z'
      )
    );
    const client = {
      measure: async () => ({
        complete: true,
        expectedProbeCount: 2,
        observedProbeCount: 2,
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
    await recordCleanupVerified(
      dir,
      input.runId,
      createCleanupVerificationReceipt(
        input.preInventorySha256,
        '2026-07-31T00:00:00.000Z'
      )
    );
    const revoke = async (tokenId: string) => ({
      tokenId,
      auditReceiptSha256: 'c'.repeat(64),
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
});

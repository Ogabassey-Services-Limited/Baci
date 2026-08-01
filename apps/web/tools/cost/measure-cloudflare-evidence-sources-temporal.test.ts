import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  openEvidenceRun,
  recordCleanupVerified,
  recordEvidenceMutation,
  recordEvidencePhase,
  recordEvidenceProbeResults,
  revokeEvidenceRunToken,
} from './cloudflare-evidence-run-journal';
import {
  type EvidenceMeasurementClient,
  measureCloudflareEvidenceSources,
  parseMeasurementArguments,
  revokeCloudflareEvidenceReadToken,
} from './measure-cloudflare-evidence-sources';

describe('parseMeasurementArguments', () => {
  it('requires a fresh read-only measurement run and has no apply mode', () => {
    expect(
      parseMeasurementArguments(['--run', '0123456789abcdef0123456789abcdef'])
        .runId
    ).toBe('0123456789abcdef0123456789abcdef');
    expect(
      parseMeasurementArguments([
        '--revoke-read',
        '0123456789abcdef0123456789abcdef',
      ]).mode
    ).toBe('revoke-read');
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
  policySha256: 'b'.repeat(64),
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write',
  readTokenId: 'read',
  readPolicySha256: 'c'.repeat(64),
  accountId: 'account',
  zoneId: 'zone',
  plannedResources: ['baci-evidence-0123456789abcdef0123456789abcdef'],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
};

const capability = {
  ...input,
  tokenId: input.readTokenId,
  permissionGroupIds: ['analytics.read'],
  resources: ['account'],
  expiresAt: '2026-08-01T00:00:00.000Z',
  policySha256: input.readPolicySha256,
  kind: 'read' as const,
  providerNegativeScopeUnverified: true as const,
};

const writeRevocationClient = {
  revoke: async (tokenId: string) => ({
    tokenId,
    auditReceiptSha256: 'd'.repeat(64),
  }),
  readBack: async (tokenId: string) => ({
    tokenId,
    status: 'inactive' as const,
    auditReceiptSha256: 'd'.repeat(64),
    observedAt: '2026-07-31T00:00:00.000Z',
  }),
};

async function createMeasuredRun() {
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
      status: 'absent' as const,
      inventorySha256: input.preInventorySha256,
      providerReceiptSha256: 'f'.repeat(64),
      observedAt: '2026-07-31T00:00:00.000Z',
    }),
  });
  await revokeEvidenceRunToken(
    dir,
    input.runId,
    'write',
    writeRevocationClient
  );
  return dir;
}

function measurementClient(observedAt: string): EvidenceMeasurementClient {
  return {
    measure: vi.fn(async () => ({
      complete: true,
      expectedProbeCount: input.expectedProbeCount,
      observedProbeCount: input.expectedProbeCount,
      providerReceiptSha256: 'a'.repeat(64),
      observedAt,
    })),
    revoke: async (tokenId: string) => ({
      tokenId,
      auditReceiptSha256: 'e'.repeat(64),
    }),
    readBack: async (tokenId: string) => ({
      tokenId,
      status: 'inactive' as const,
      auditReceiptSha256: 'e'.repeat(64),
      observedAt: '2026-07-31T00:00:00.000Z',
    }),
  };
}

describe('measurement observation timestamps', () => {
  it('rejects a future provider observation', async () => {
    const dir = await createMeasuredRun();
    await expect(
      measureCloudflareEvidenceSources(
        dir,
        input.runId,
        capability,
        measurementClient('2026-07-31T00:06:00.000Z'),
        { now: new Date('2026-07-31T00:05:00.000Z') }
      )
    ).rejects.toThrow('outside the active run window');
  });

  it('rejects an observation older than the active run revocation boundary', async () => {
    const dir = await createMeasuredRun();
    await expect(
      measureCloudflareEvidenceSources(
        dir,
        input.runId,
        capability,
        measurementClient('2026-07-30T23:59:59.999Z'),
        { now: new Date('2026-07-31T00:05:00.000Z') }
      )
    ).rejects.toThrow('outside the active run window');
  });

  it('rejects an observation beyond the qualified export-lag window', async () => {
    const dir = await createMeasuredRun();
    await expect(
      measureCloudflareEvidenceSources(
        dir,
        input.runId,
        capability,
        measurementClient('2026-07-31T00:00:00.000Z'),
        { now: new Date('2026-08-01T00:01:00.000Z') }
      )
    ).rejects.toThrow('outside the active run window');
  });
});

describe('incomplete-run read-token revocation', () => {
  it('revokes the read token and closes the stop run without measuring', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    await recordEvidenceMutation(
      dir,
      input.runId,
      input.plannedResources[0],
      'resource-id'
    );
    await recordEvidencePhase(dir, input.runId, 'cleanup_incomplete_stop', {
      cleanupAttempts: 1,
      cleanupIncomplete: true,
      readBackEvidence: ['synthetic probe evidence incomplete; STOP'],
    });
    await revokeEvidenceRunToken(
      dir,
      input.runId,
      'write',
      writeRevocationClient
    );
    const measure = vi.fn(async () => ({
      complete: true,
      expectedProbeCount: input.expectedProbeCount,
      observedProbeCount: input.expectedProbeCount,
      providerReceiptSha256: 'a'.repeat(64),
      observedAt: '2026-07-31T00:00:00.000Z',
    }));
    const result = await revokeCloudflareEvidenceReadToken(
      dir,
      input.runId,
      capability,
      {
        measure,
        revoke: async (tokenId) => ({
          tokenId,
          auditReceiptSha256: 'e'.repeat(64),
        }),
        readBack: async (tokenId) => ({
          tokenId,
          status: 'inactive' as const,
          auditReceiptSha256: 'e'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      }
    );
    expect(result.phase).toBe('closed_stop');
    expect(result.readTokenRevocationReceipt).toMatchObject({
      tokenId: input.readTokenId,
      status: 'revoked',
    });
    expect(measure).not.toHaveBeenCalled();
  });
});

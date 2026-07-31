import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  openEvidenceRun,
  recordTokenRevocation,
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
    const client = {
      measure: async () => ({
        complete: true,
        expectedProbeCount: 2,
        observedProbeCount: 2,
      }),
      verifyReadTokenRevocation: async () => ({
        tokenId: 'wrong',
        status: 'revoked' as const,
        providerReceiptSha256: 'c'.repeat(64),
        observedAt: '2026-07-31T00:00:00.000Z',
      }),
    };
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, client)
    ).rejects.toThrow('write');
    await recordTokenRevocation(dir, input.runId, 'write', {
      tokenId: 'write',
      status: 'revoked',
      providerReceiptSha256: 'd'.repeat(64),
      observedAt: '2026-07-31T00:00:00.000Z',
    });
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, client)
    ).rejects.toThrow('does not match');
    await expect(
      measureCloudflareEvidenceSources(dir, input.runId, capability, {
        ...client,
        verifyReadTokenRevocation: async () => ({
          tokenId: 'read',
          status: 'revoked' as const,
          providerReceiptSha256: 'e'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      })
    ).resolves.toMatchObject({ phase: 'read_token_revoked' });
  });
});

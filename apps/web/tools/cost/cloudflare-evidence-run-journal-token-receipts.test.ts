import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  openEvidenceRun,
  revokeEvidenceRunToken,
} from './cloudflare-evidence-run-journal';

const input = {
  runId: '0123456789abcdef0123456789abcdef',
  approvalId: 'approval',
  policyId: 'policy',
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write',
  readTokenId: 'read',
  readPolicySha256: 'c'.repeat(64),
  accountId: 'account',
  zoneId: 'zone',
  plannedResources: ['evidence-run-123-worker'],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
};

describe('CloudflareEvidenceRunJournal token receipts', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      directories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true }))
    );
  });

  it.each([
    {
      name: 'wrong revoked token',
      message: 'provider revoked the wrong token',
      client: {
        revoke: async () => ({
          tokenId: 'wrong',
          auditReceiptSha256: 'a'.repeat(64),
        }),
        readBack: async () => ({
          tokenId: 'write',
          status: 'inactive' as const,
          auditReceiptSha256: 'b'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      },
    },
    {
      name: 'provider revoke failure',
      message: 'provider revoke failed',
      client: {
        revoke: async () => {
          throw new Error('provider revoke failed');
        },
        readBack: async () => ({
          tokenId: 'write',
          status: 'inactive' as const,
          auditReceiptSha256: 'b'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      },
    },
    {
      name: 'active provider readback',
      message: 'provider readback did not verify token revocation',
      client: {
        revoke: async () => ({
          tokenId: 'write',
          auditReceiptSha256: 'a'.repeat(64),
        }),
        readBack: async () => ({
          tokenId: 'write',
          status: 'active' as const,
          auditReceiptSha256: 'b'.repeat(64),
          observedAt: '2026-07-31T00:00:00.000Z',
        }),
      },
    },
  ])('rejects $name', async ({ client, message }) => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
    directories.push(dir);
    await chmod(dir, 0o700);
    await openEvidenceRun(dir, input);
    await expect(
      revokeEvidenceRunToken(dir, input.runId, 'write', client)
    ).rejects.toThrow(message);
  });
});

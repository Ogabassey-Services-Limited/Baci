import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
  it('rejects provider responses for the wrong token, a failed revoke, or an active readback', async () => {
    const cases = [
      {
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
      {
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
      {
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
    ];
    for (const client of cases) {
      const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
      await chmod(dir, 0o700);
      await openEvidenceRun(dir, input);
      await expect(
        revokeEvidenceRunToken(dir, input.runId, 'write', client)
      ).rejects.toThrow();
    }
  });
});

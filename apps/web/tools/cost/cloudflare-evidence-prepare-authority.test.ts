import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calculateReviewedPolicySha256,
  verifyPrepareAuthority,
} from './cloudflare-evidence-prepare-authority';

const input = {
  approvalId: 'approval-id',
  policyId: 'policy-id',
  toolingMergeSha: 'a'.repeat(40),
  writeTokenId: 'write-token',
  readTokenId: 'read-token',
  readPolicySha256: 'c'.repeat(64),
  accountId: 'account-id',
  zoneId: 'zone-id',
};

function policy(expiresAt: string) {
  const content = {
    tokenId: input.writeTokenId,
    accountId: input.accountId,
    zoneId: input.zoneId,
    permissionGroupIds: ['workers.write'],
    resources: ['account'],
    expiresAt,
  };
  return {
    id: input.policyId,
    toolingMergeSha: input.toolingMergeSha,
    ...content,
    policySha256: calculateReviewedPolicySha256(content),
  };
}

describe('cloudflare evidence prepare authority', () => {
  it('fingerprints the complete reviewed token policy without identity wrappers', () => {
    const content = policy('2026-08-01T13:00:00.000Z');
    expect(content.policySha256).toBe(
      calculateReviewedPolicySha256({
        tokenId: content.tokenId,
        accountId: content.accountId,
        zoneId: content.zoneId,
        permissionGroupIds: content.permissionGroupIds,
        resources: content.resources,
        expiresAt: content.expiresAt,
      })
    );
  });

  it('rejects a reviewed policy whose account binding differs from prepare input', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-authority-'));
    await chmod(dir, 0o700);
    const expiresAt = '2026-08-01T13:00:00.000Z';
    const reviewed = policy(expiresAt);
    const approval = {
      id: input.approvalId,
      toolingMergeSha: input.toolingMergeSha,
      policyId: input.policyId,
      policySha256: reviewed.policySha256,
      readTokenId: input.readTokenId,
      readPolicySha256: input.readPolicySha256,
      approvedAt: '2026-08-01T11:00:00.000Z',
      expiresAt,
    };
    const approvalPath = join(dir, 'approval.json');
    const policyPath = join(dir, 'policy.json');
    await writeFile(approvalPath, JSON.stringify(approval), { mode: 0o600 });
    await writeFile(policyPath, JSON.stringify(reviewed), { mode: 0o600 });
    await expect(
      verifyPrepareAuthority(
        { ...input, accountId: 'different-account' },
        {
          EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
          EVIDENCE_POLICY_ARTIFACT: policyPath,
        },
        new Date('2026-08-01T12:00:00.000Z')
      )
    ).rejects.toThrow('identities');
  });
});

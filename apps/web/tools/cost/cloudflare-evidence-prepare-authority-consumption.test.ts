import { chmod, cp, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calculateReviewedPolicySha256,
  verifyPrepareAuthority,
} from './cloudflare-evidence-prepare-authority';

const input = {
  runId: 'a'.repeat(32),
  approvalId: 'approval-id',
  policyId: 'policy-id',
  toolingMergeSha: 'a'.repeat(40),
  writeTokenId: 'write-token',
  readTokenId: 'read-token',
  readPolicySha256: 'c'.repeat(64),
  accountId: 'account-id',
  zoneId: 'zone-id',
};

async function makePrivateTempDir() {
  const directory = await mkdtemp(
    join(await realpath(tmpdir()), 'baci-evidence-authority-clone-')
  );
  await chmod(directory, 0o700);
  return directory;
}

function makePolicy(expiresAt: string) {
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

describe('cloudflare evidence approval consumption scope', () => {
  it('keeps consumption when the complete authority scope is cloned', async () => {
    const directory = await makePrivateTempDir();
    const expiresAt = '2026-08-01T13:00:00.000Z';
    const reviewed = makePolicy(expiresAt);
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
    const approvalPath = join(directory, 'approval.json');
    const policyPath = join(directory, 'policy.json');
    await writeFile(approvalPath, JSON.stringify(approval), { mode: 0o600 });
    await writeFile(policyPath, JSON.stringify(reviewed), { mode: 0o600 });
    const cloneParent = await makePrivateTempDir();
    const clone = join(cloneParent, 'authority-clone');
    try {
      await verifyPrepareAuthority(
        input,
        {
          EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
          EVIDENCE_POLICY_ARTIFACT: policyPath,
          EVIDENCE_RUN_STATE_DIR: join(directory, 'state-a'),
        },
        new Date('2026-08-01T12:00:00.000Z')
      );
      await cp(directory, clone, { recursive: true });
      await expect(
        verifyPrepareAuthority(
          { ...input, runId: 'b'.repeat(32) },
          {
            EVIDENCE_APPROVAL_ARTIFACT: join(clone, 'approval.json'),
            EVIDENCE_POLICY_ARTIFACT: join(clone, 'policy.json'),
            EVIDENCE_RUN_STATE_DIR: join(clone, 'state-b'),
          },
          new Date('2026-08-01T12:00:00.000Z')
        )
      ).rejects.toThrow('already consumed');
    } finally {
      await rm(directory, { recursive: true, force: true });
      await rm(cloneParent, { recursive: true, force: true });
    }
  });
});

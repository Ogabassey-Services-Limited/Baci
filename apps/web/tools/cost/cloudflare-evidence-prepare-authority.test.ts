import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
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

async function makeAuthorityTempDir() {
  const dir = await mkdtemp(
    join(await realpath(tmpdir()), 'baci-evidence-authority-')
  );
  await chmod(dir, 0o700);
  return dir;
}

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
    const dir = await makeAuthorityTempDir();
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

  it('consumes one approval in its fixed authority scope for one run and state directory', async () => {
    const dir = await makeAuthorityTempDir();
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
    const stateDir = join(dir, 'state-a');
    const environment = {
      EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
      EVIDENCE_POLICY_ARTIFACT: policyPath,
      EVIDENCE_RUN_STATE_DIR: stateDir,
    };
    try {
      await expect(
        verifyPrepareAuthority(
          input,
          environment,
          new Date('2026-08-01T12:00:00.000Z')
        )
      ).resolves.toMatchObject({ approvalId: input.approvalId });
      await expect(
        verifyPrepareAuthority(
          { ...input, runId: 'b'.repeat(32) },
          { ...environment, EVIDENCE_RUN_STATE_DIR: join(dir, 'state-b') },
          new Date('2026-08-01T12:00:00.000Z')
        )
      ).rejects.toThrow('already consumed');
      await expect(
        verifyPrepareAuthority(
          input,
          environment,
          new Date('2026-08-01T12:00:00.000Z')
        )
      ).resolves.toMatchObject({ approvalId: input.approvalId });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects an authority symlink before reading substituted bytes', async () => {
    const dir = await makeAuthorityTempDir();
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
    const targetPath = join(dir, 'approval-target.json');
    const approvalPath = join(dir, 'approval.json');
    const policyPath = join(dir, 'policy.json');
    await writeFile(targetPath, JSON.stringify(approval), { mode: 0o600 });
    await symlink(targetPath, approvalPath);
    await writeFile(policyPath, JSON.stringify(reviewed), { mode: 0o600 });
    try {
      await expect(
        verifyPrepareAuthority(
          input,
          {
            EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
            EVIDENCE_POLICY_ARTIFACT: policyPath,
          },
          new Date('2026-08-01T12:00:00.000Z')
        )
      ).rejects.toThrow('private regular file');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects an intermediate authority symlink before reading substituted bytes', async () => {
    const dir = await makeAuthorityTempDir();
    const targetRoot = join(dir, 'target-root');
    const authorityScope = join(targetRoot, 'authority');
    const linkedRoot = join(dir, 'linked-root');
    await mkdir(authorityScope, { recursive: true, mode: 0o700 });
    await symlink(targetRoot, linkedRoot, 'dir');
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
    const approvalPath = join(linkedRoot, 'authority', 'approval.json');
    const policyPath = join(linkedRoot, 'authority', 'policy.json');
    await writeFile(approvalPath, JSON.stringify(approval), { mode: 0o600 });
    await writeFile(policyPath, JSON.stringify(reviewed), { mode: 0o600 });
    try {
      await expect(
        verifyPrepareAuthority(
          input,
          {
            EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
            EVIDENCE_POLICY_ARTIFACT: policyPath,
          },
          new Date('2026-08-01T12:00:00.000Z')
        )
      ).rejects.toThrow('symlink');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('accepts authority artifacts when every ancestor is a private directory', async () => {
    const dir = await makeAuthorityTempDir();
    const authorityScope = join(dir, 'nested', 'authority');
    await mkdir(authorityScope, { recursive: true, mode: 0o700 });
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
    const approvalPath = join(authorityScope, 'approval.json');
    const policyPath = join(authorityScope, 'policy.json');
    await writeFile(approvalPath, JSON.stringify(approval), { mode: 0o600 });
    await writeFile(policyPath, JSON.stringify(reviewed), { mode: 0o600 });
    try {
      await expect(
        verifyPrepareAuthority(
          input,
          {
            EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
            EVIDENCE_POLICY_ARTIFACT: policyPath,
          },
          new Date('2026-08-01T12:00:00.000Z')
        )
      ).resolves.toMatchObject({ approvalId: input.approvalId });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

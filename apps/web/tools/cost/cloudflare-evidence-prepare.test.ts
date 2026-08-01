import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calculateReviewedPolicySha256,
  cloudflareEvidencePrepare,
  verifyPrepareAuthority,
} from './cloudflare-evidence-prepare';

const runId = 'a'.repeat(32);
const input = {
  runId,
  approvalId: 'approval-123',
  policyId: 'policy-123',
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write-token-id',
  readTokenId: 'read-token-id',
  readPolicySha256: 'c'.repeat(64),
  accountId: 'account-id',
  zoneId: 'zone-id',
  plannedResources: [`baci-evidence-${runId}`],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
};

describe('cloudflareEvidencePrepare', () => {
  it('round-trips the bounded credentialless prepare options', () => {
    expect(
      cloudflareEvidencePrepare.parseArguments(
        cloudflareEvidencePrepare.argumentsFor(input)
      )
    ).toEqual(input);
  });

  it('rejects unknown options, invalid tooling SHAs, and unrelated resources', () => {
    const valid = cloudflareEvidencePrepare.argumentsFor(input);
    for (const args of [
      [...valid, '--token', 'secret'],
      valid.map((value) => (value === input.runId ? 'run-123' : value)),
      valid.map((value) => (value === input.toolingMergeSha ? 'bad' : value)),
      valid.map((value) => (value === '2' ? '3' : value)),
      valid.map((value) =>
        value === input.plannedResources[0] ? 'foreign-resource' : value
      ),
    ])
      expect(() => cloudflareEvidencePrepare.parseArguments(args)).toThrow();
  });

  it('requires matching owner approval and reviewed policy artifacts before a run can be prepared', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-authority-'));
    await chmod(dir, 0o700);
    const now = new Date('2026-08-01T12:00:00.000Z');
    const policy = {
      id: input.policyId,
      toolingMergeSha: input.toolingMergeSha,
      tokenId: input.writeTokenId,
      accountId: input.accountId,
      zoneId: input.zoneId,
      permissionGroupIds: ['workers.write'],
      resources: ['account'],
      expiresAt: '2026-08-01T13:00:00.000Z',
      policySha256: calculateReviewedPolicySha256({
        tokenId: input.writeTokenId,
        accountId: input.accountId,
        zoneId: input.zoneId,
        permissionGroupIds: ['workers.write'],
        resources: ['account'],
        expiresAt: '2026-08-01T13:00:00.000Z',
      }),
    };
    const approval = {
      id: input.approvalId,
      toolingMergeSha: input.toolingMergeSha,
      policyId: input.policyId,
      policySha256: policy.policySha256,
      readTokenId: input.readTokenId,
      readPolicySha256: input.readPolicySha256,
      approvedAt: '2026-08-01T11:00:00.000Z',
      expiresAt: '2026-08-01T13:00:00.000Z',
    };
    const approvalPath = join(dir, 'approval.json');
    const policyPath = join(dir, 'policy.json');
    await writeFile(approvalPath, `${JSON.stringify(approval)}\n`, {
      mode: 0o600,
    });
    await writeFile(policyPath, `${JSON.stringify(policy)}\n`, {
      mode: 0o600,
    });
    await expect(
      verifyPrepareAuthority(
        input,
        {
          EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
          EVIDENCE_POLICY_ARTIFACT: policyPath,
        },
        now
      )
    ).resolves.toEqual({
      approvalId: input.approvalId,
      policyId: input.policyId,
      policySha256: policy.policySha256,
      readPolicySha256: input.readPolicySha256,
    });
    await expect(
      verifyPrepareAuthority(
        { ...input, readPolicySha256: 'd'.repeat(64) },
        {
          EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
          EVIDENCE_POLICY_ARTIFACT: policyPath,
        },
        now
      )
    ).rejects.toThrow('identities');
    await writeFile(
      approvalPath,
      `${JSON.stringify({ ...approval, policyId: 'other-policy' })}\n`
    );
    await expect(
      verifyPrepareAuthority(
        input,
        {
          EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
          EVIDENCE_POLICY_ARTIFACT: policyPath,
        },
        now
      )
    ).rejects.toThrow('identities');

    await writeFile(approvalPath, `${JSON.stringify(approval)}\n`);
    await writeFile(
      policyPath,
      `${JSON.stringify({ ...policy, tokenId: input.readTokenId })}\n`
    );
    await expect(
      verifyPrepareAuthority(
        input,
        {
          EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
          EVIDENCE_POLICY_ARTIFACT: policyPath,
        },
        now
      )
    ).rejects.toThrow('identities');

    await writeFile(policyPath, `${JSON.stringify(policy)}\n`);
    await expect(
      verifyPrepareAuthority(
        { ...input, readTokenId: input.writeTokenId },
        {
          EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
          EVIDENCE_POLICY_ARTIFACT: policyPath,
        },
        now
      )
    ).rejects.toThrow('identities');
  });

  it('binds an optional cleanup replacement policy fingerprint to owner approval', async () => {
    const cleanupPolicySha256 = 'd'.repeat(64);
    const cleanupInput = { ...input, cleanupPolicySha256 };
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-cleanup-policy-'));
    await chmod(dir, 0o700);
    const policy = {
      id: cleanupInput.policyId,
      toolingMergeSha: cleanupInput.toolingMergeSha,
      tokenId: cleanupInput.writeTokenId,
      accountId: cleanupInput.accountId,
      zoneId: cleanupInput.zoneId,
      permissionGroupIds: ['workers.write'],
      resources: ['account'],
      expiresAt: '2026-08-01T13:00:00.000Z',
      policySha256: calculateReviewedPolicySha256({
        tokenId: cleanupInput.writeTokenId,
        accountId: cleanupInput.accountId,
        zoneId: cleanupInput.zoneId,
        permissionGroupIds: ['workers.write'],
        resources: ['account'],
        expiresAt: '2026-08-01T13:00:00.000Z',
      }),
    };
    const approval = {
      id: cleanupInput.approvalId,
      toolingMergeSha: cleanupInput.toolingMergeSha,
      policyId: cleanupInput.policyId,
      policySha256: policy.policySha256,
      readTokenId: cleanupInput.readTokenId,
      readPolicySha256: cleanupInput.readPolicySha256,
      cleanupPolicySha256,
      approvedAt: '2026-08-01T11:00:00.000Z',
      expiresAt: '2026-08-01T13:00:00.000Z',
    };
    const approvalPath = join(dir, 'approval.json');
    const policyPath = join(dir, 'policy.json');
    await writeFile(approvalPath, JSON.stringify(approval), { mode: 0o600 });
    await writeFile(policyPath, JSON.stringify(policy), { mode: 0o600 });
    await expect(
      verifyPrepareAuthority(
        cleanupInput,
        {
          EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
          EVIDENCE_POLICY_ARTIFACT: policyPath,
        },
        new Date('2026-08-01T12:00:00.000Z')
      )
    ).resolves.toMatchObject({ cleanupPolicySha256 });
    expect(cloudflareEvidencePrepare.argumentsFor(cleanupInput)).toContain(
      '--cleanup-policy-sha256'
    );
  });

  it('rejects missing, mutable, or expired authority artifacts', async () => {
    await expect(
      verifyPrepareAuthority(input, {}, new Date('2026-08-01T12:00:00.000Z'))
    ).rejects.toThrow('ARTIFACT');
    const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-authority-'));
    const policy = {
      id: input.policyId,
      toolingMergeSha: input.toolingMergeSha,
      tokenId: input.writeTokenId,
      accountId: input.accountId,
      zoneId: input.zoneId,
      permissionGroupIds: ['workers.write'],
      resources: ['account'],
      expiresAt: '2026-08-01T11:59:59.000Z',
      policySha256: calculateReviewedPolicySha256({
        tokenId: input.writeTokenId,
        accountId: input.accountId,
        zoneId: input.zoneId,
        permissionGroupIds: ['workers.write'],
        resources: ['account'],
        expiresAt: '2026-08-01T11:59:59.000Z',
      }),
    };
    const approvalPath = join(dir, 'approval.json');
    const policyPath = join(dir, 'policy.json');
    await writeFile(
      approvalPath,
      JSON.stringify({
        id: input.approvalId,
        toolingMergeSha: input.toolingMergeSha,
        policyId: input.policyId,
        policySha256: policy.policySha256,
        readTokenId: input.readTokenId,
        readPolicySha256: input.readPolicySha256,
        approvedAt: '2026-08-01T11:00:00.000Z',
        expiresAt: '2026-08-01T11:59:59.000Z',
      }),
      { mode: 0o600 }
    );
    await writeFile(policyPath, JSON.stringify(policy), { mode: 0o600 });
    await expect(
      verifyPrepareAuthority(
        input,
        {
          EVIDENCE_APPROVAL_ARTIFACT: approvalPath,
          EVIDENCE_POLICY_ARTIFACT: policyPath,
        },
        new Date('2026-08-01T12:00:00.000Z')
      )
    ).rejects.toThrow('expired');
  });
});

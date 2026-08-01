import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calculateCloudflareEvidenceTokenPolicySha256,
  verifyCloudflareEvidenceTokenPolicy,
} from './verify-cloudflare-evidence-token-policy';

const policyContent = {
  tokenId: 'write-id',
  accountId: 'account',
  zoneId: 'zone',
  permissionGroupIds: ['workers.write'],
  resources: ['com.cloudflare.api.account.account'],
  expiresAt: '2026-08-01T14:00:00.000Z',
};
const policy = {
  ...policyContent,
  policySha256: calculateCloudflareEvidenceTokenPolicySha256(policyContent),
};
describe('verifyCloudflareEvidenceTokenPolicy', () => {
  it('requires a live verified ID and exact owner/reviewed scopes before branding write capability', async () => {
    await expect(
      verifyCloudflareEvidenceTokenPolicy(
        'token',
        policy,
        policy,
        {
          verify: async () => ({ id: 'write-id', status: 'active' }),
        },
        { now: () => new Date('2026-08-01T12:00:00.000Z') }
      )
    ).resolves.toBeDefined();
    await expect(
      verifyCloudflareEvidenceTokenPolicy(
        'token',
        policy,
        { ...policy, zoneId: 'other' },
        { verify: async () => ({ id: 'write-id', status: 'active' }) },
        { now: () => new Date('2026-07-31T23:00:00.000Z') }
      )
    ).rejects.toThrow('policy');
  });
  it('rejects an expiry beyond the two-hour write-token window', async () => {
    const longLivedContent = {
      ...policyContent,
      expiresAt: '2026-08-02T00:00:00.000Z',
    };
    const longLived = {
      ...longLivedContent,
      policySha256:
        calculateCloudflareEvidenceTokenPolicySha256(longLivedContent),
    };
    await expect(
      verifyCloudflareEvidenceTokenPolicy(
        'token',
        longLived,
        longLived,
        { verify: async () => ({ id: 'write-id', status: 'active' }) },
        { now: () => new Date('2026-08-01T00:00:00.000Z') }
      )
    ).rejects.toThrow('maximum lifetime');
  });
  it('rejects altered authority that reuses an old policy fingerprint', async () => {
    await expect(
      verifyCloudflareEvidenceTokenPolicy(
        'token',
        { ...policy, permissionGroupIds: ['workers.write', 'dns.write'] },
        { ...policy, permissionGroupIds: ['workers.write', 'dns.write'] },
        { verify: async () => ({ id: 'write-id', status: 'active' }) },
        { now: () => new Date('2026-08-01T12:00:00.000Z') }
      )
    ).rejects.toThrow('fingerprint');
  });
  it('keeps the checked-in policy descriptive until the owner provisions a reviewed projection', async () => {
    const policyDocument = JSON.parse(
      await readFile(
        resolve(
          import.meta.dirname,
          '../../../../.github/cloudflare/ogabassey-evidence-qualification-policy.json'
        ),
        'utf8'
      )
    ) as {
      notProvisioned?: boolean;
      tokenValueNeverStored?: boolean;
      reviewedWriteTokenPolicy?: Record<string, unknown>;
    };
    expect(policyDocument).toMatchObject({
      notProvisioned: true,
      tokenValueNeverStored: true,
      reviewedWriteTokenPolicy: {
        tokenId: expect.any(String),
        accountId: expect.any(String),
        zoneId: expect.any(String),
        permissionGroupIds: expect.any(Array),
        resources: expect.any(Array),
        expiresAt: expect.any(String),
        policySha256: expect.any(String),
      },
    });
  });
});

import { describe, expect, it } from 'vitest';
import { verifyCloudflareEvidenceReadTokenPolicy } from './verify-cloudflare-evidence-read-token-policy';

const policy = {
  tokenId: 'read-id',
  accountId: 'account',
  zoneId: 'zone',
  permissionGroupIds: ['analytics.read'],
  resources: ['com.cloudflare.api.account.account'],
  expiresAt: '2026-08-01T00:00:00.000Z',
  policySha256: 'b'.repeat(64),
};
describe('verifyCloudflareEvidenceReadTokenPolicy', () => {
  it('brands a separate read capability and rejects every write permission', async () => {
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        policy,
        policy,
        {
          verify: async () => ({ id: 'read-id', status: 'active' }),
        },
        [{ id: 'analytics.read', capability: 'read' }],
        { now: () => new Date('2026-07-31T23:00:00.000Z') }
      )
    ).resolves.toBeDefined();
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        { ...policy, permissionGroupIds: ['workers.write'] },
        { ...policy, permissionGroupIds: ['workers.write'] },
        { verify: async () => ({ id: 'read-id', status: 'active' }) },
        [{ id: 'workers.write', capability: 'write' }],
        { now: () => new Date('2026-07-31T23:00:00.000Z') }
      )
    ).rejects.toThrow('write');
  });
  it('rejects opaque permission IDs unless reviewed metadata proves read-only capability', async () => {
    const opaque = { ...policy, permissionGroupIds: ['018f-opaque-write-id'] };
    const client = {
      verify: async () => ({ id: 'read-id', status: 'active' }),
    };
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        opaque,
        opaque,
        client,
        [],
        { now: () => new Date('2026-07-31T23:00:00.000Z') }
      )
    ).rejects.toThrow('allowlist');
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        opaque,
        opaque,
        client,
        [{ id: '018f-opaque-write-id', capability: 'write' }],
        { now: () => new Date('2026-07-31T23:00:00.000Z') }
      )
    ).rejects.toThrow('read-only');
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        opaque,
        opaque,
        client,
        [{ id: '018f-opaque-write-id', capability: 'read' }],
        { now: () => new Date('2026-07-31T23:00:00.000Z') }
      )
    ).resolves.toMatchObject({ kind: 'read' });
  });
});

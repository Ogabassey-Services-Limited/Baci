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
      verifyCloudflareEvidenceReadTokenPolicy('token', policy, policy, {
        verify: async () => ({ id: 'read-id', status: 'active' }),
      })
    ).resolves.toBeDefined();
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        { ...policy, permissionGroupIds: ['workers.write'] },
        { ...policy, permissionGroupIds: ['workers.write'] },
        { verify: async () => ({ id: 'read-id', status: 'active' }) }
      )
    ).rejects.toThrow('write');
  });
});

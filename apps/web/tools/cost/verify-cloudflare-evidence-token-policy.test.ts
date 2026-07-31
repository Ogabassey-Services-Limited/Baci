import { describe, expect, it } from 'vitest';
import { verifyCloudflareEvidenceTokenPolicy } from './verify-cloudflare-evidence-token-policy';

const policy = {
  tokenId: 'write-id',
  accountId: 'account',
  zoneId: 'zone',
  permissionGroupIds: ['workers.write'],
  resources: ['com.cloudflare.api.account.account'],
  expiresAt: '2026-08-01T00:00:00.000Z',
  policySha256: 'a'.repeat(64),
};
describe('verifyCloudflareEvidenceTokenPolicy', () => {
  it('requires a live verified ID and exact owner/reviewed scopes before branding write capability', async () => {
    await expect(
      verifyCloudflareEvidenceTokenPolicy('token', policy, policy, {
        verify: async () => ({ id: 'write-id', status: 'active' }),
      })
    ).resolves.toBeDefined();
    await expect(
      verifyCloudflareEvidenceTokenPolicy(
        'token',
        policy,
        { ...policy, zoneId: 'other' },
        { verify: async () => ({ id: 'write-id', status: 'active' }) }
      )
    ).rejects.toThrow('policy');
  });
});

import { describe, expect, it } from 'vitest';
import {
  calculateReviewedPermissionMetadataSha256,
  verifyCloudflareEvidenceReadTokenPolicy,
} from './verify-cloudflare-evidence-read-token-policy';
import { calculateCloudflareEvidenceTokenPolicySha256 } from './verify-cloudflare-evidence-token-policy';

const policyContent = {
  tokenId: 'read-id',
  accountId: 'account',
  zoneId: 'zone',
  permissionGroupIds: ['analytics.read'],
  resources: ['com.cloudflare.api.account.account'],
  expiresAt: '2026-08-01T14:00:00.000Z',
};
const policy = {
  ...policyContent,
  policySha256: calculateCloudflareEvidenceTokenPolicySha256(policyContent),
};
describe('verifyCloudflareEvidenceReadTokenPolicy', () => {
  it('brands a separate read capability and rejects every write permission', async () => {
    const readMetadata = [
      { id: 'analytics.read', capability: 'read' as const },
    ];
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        policy,
        policy,
        {
          verify: async () => ({ id: 'read-id', status: 'active' }),
        },
        readMetadata,
        {
          now: () => new Date('2026-08-01T12:00:00.000Z'),
          permissionMetadataSha256:
            calculateReviewedPermissionMetadataSha256(readMetadata),
        }
      )
    ).resolves.toBeDefined();
    const writeContent = {
      ...policyContent,
      permissionGroupIds: ['workers.write'],
    };
    const writePolicy = {
      ...writeContent,
      policySha256: calculateCloudflareEvidenceTokenPolicySha256(writeContent),
    };
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        writePolicy,
        writePolicy,
        { verify: async () => ({ id: 'read-id', status: 'active' }) },
        [{ id: 'workers.write', capability: 'write' }],
        {
          now: () => new Date('2026-08-01T12:00:00.000Z'),
          permissionMetadataSha256: calculateReviewedPermissionMetadataSha256([
            { id: 'workers.write', capability: 'write' },
          ]),
        }
      )
    ).rejects.toThrow('write');
  });
  it('rejects opaque permission IDs unless reviewed metadata proves read-only capability', async () => {
    const opaqueContent = {
      ...policyContent,
      permissionGroupIds: ['018f-opaque-write-id'],
    };
    const opaque = {
      ...opaqueContent,
      policySha256: calculateCloudflareEvidenceTokenPolicySha256(opaqueContent),
    };
    const client = {
      verify: async () => ({ id: 'read-id', status: 'active' }),
    };
    const opaqueReadMetadata = [
      { id: '018f-opaque-write-id', capability: 'read' as const },
    ];
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        opaque,
        opaque,
        client,
        [],
        {
          now: () => new Date('2026-08-01T12:00:00.000Z'),
          permissionMetadataSha256: calculateReviewedPermissionMetadataSha256(
            []
          ),
        }
      )
    ).rejects.toThrow('permission metadata');
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        opaque,
        opaque,
        client,
        [{ id: '018f-opaque-write-id', capability: 'write' }],
        {
          now: () => new Date('2026-08-01T12:00:00.000Z'),
          permissionMetadataSha256: calculateReviewedPermissionMetadataSha256([
            { id: '018f-opaque-write-id', capability: 'write' },
          ]),
        }
      )
    ).rejects.toThrow('read-only');
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        opaque,
        opaque,
        client,
        opaqueReadMetadata,
        {
          now: () => new Date('2026-08-01T12:00:00.000Z'),
          permissionMetadataSha256:
            calculateReviewedPermissionMetadataSha256(opaqueReadMetadata),
        }
      )
    ).resolves.toMatchObject({ kind: 'read' });
  });
});

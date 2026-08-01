import { describe, expect, it } from 'vitest';
import {
  calculateReviewedPermissionMetadataSha256,
  verifyCloudflareEvidenceReadTokenPolicy,
} from './verify-cloudflare-evidence-read-token-policy';
import { calculateCloudflareEvidenceTokenPolicySha256 } from './verify-cloudflare-evidence-token-policy';

const readMetadata = [{ id: 'analytics.read', capability: 'read' as const }];
const policyContent = {
  tokenId: 'read-id',
  accountId: 'account',
  zoneId: 'zone',
  permissionGroupIds: ['analytics.read'],
  resources: ['com.cloudflare.api.account.account'],
  expiresAt: '2026-08-02T12:00:00.000Z',
  permissionMetadataSha256:
    calculateReviewedPermissionMetadataSha256(readMetadata),
};
const policy = {
  ...policyContent,
  policySha256: calculateCloudflareEvidenceTokenPolicySha256(policyContent),
};
describe('verifyCloudflareEvidenceReadTokenPolicy', () => {
  it('brands a separate read capability and rejects every write permission', async () => {
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        policy,
        policy,
        {
          verify: async () => ({
            id: 'read-id',
            status: 'active',
            issuedAt: '2026-08-01T12:00:00.000Z',
          }),
        },
        readMetadata,
        {
          now: () => new Date('2026-08-01T12:00:00.000Z'),
        }
      )
    ).resolves.toBeDefined();
    const writeContent = {
      ...policyContent,
      permissionGroupIds: ['workers.write'],
      permissionMetadataSha256: calculateReviewedPermissionMetadataSha256([
        { id: 'workers.write', capability: 'write' as const },
      ]),
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
        {
          verify: async () => ({
            id: 'read-id',
            status: 'active',
            issuedAt: '2026-08-01T12:00:00.000Z',
          }),
        },
        [{ id: 'workers.write', capability: 'write' }],
        {
          now: () => new Date('2026-08-01T12:00:00.000Z'),
        }
      )
    ).rejects.toThrow('write');

    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        writePolicy,
        writePolicy,
        {
          verify: async () => ({
            id: 'read-id',
            status: 'active',
            issuedAt: '2026-08-01T12:00:00.000Z',
          }),
        },
        [{ id: 'workers.write', capability: 'read' }],
        {
          now: () => new Date('2026-08-01T12:00:00.000Z'),
          permissionMetadataSha256: calculateReviewedPermissionMetadataSha256([
            { id: 'workers.write', capability: 'read' },
          ]),
        }
      )
    ).rejects.toThrow('permission metadata');
  });
  it('rejects opaque permission IDs unless reviewed metadata proves read-only capability', async () => {
    const opaqueContent = {
      ...policyContent,
      permissionGroupIds: ['018f-opaque-write-id'],
      permissionMetadataSha256: calculateReviewedPermissionMetadataSha256([
        { id: '018f-opaque-write-id', capability: 'read' as const },
      ]),
    };
    const opaque = {
      ...opaqueContent,
      policySha256: calculateCloudflareEvidenceTokenPolicySha256(opaqueContent),
    };
    const client = {
      verify: async () => ({
        id: 'read-id',
        status: 'active',
        issuedAt: '2026-08-01T12:00:00.000Z',
      }),
    };
    const opaqueReadMetadata = [
      { id: '018f-opaque-write-id', capability: 'read' as const },
    ];
    const opaqueWriteMetadata = [
      { id: '018f-opaque-write-id', capability: 'write' as const },
    ];
    const opaqueWrite = {
      ...opaqueContent,
      permissionMetadataSha256:
        calculateReviewedPermissionMetadataSha256(opaqueWriteMetadata),
      policySha256: calculateCloudflareEvidenceTokenPolicySha256({
        ...opaqueContent,
        permissionMetadataSha256:
          calculateReviewedPermissionMetadataSha256(opaqueWriteMetadata),
      }),
    };
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        opaque,
        opaque,
        client,
        [],
        {
          now: () => new Date('2026-08-01T12:00:00.000Z'),
        }
      )
    ).rejects.toThrow('permission metadata');
    await expect(
      verifyCloudflareEvidenceReadTokenPolicy(
        'token',
        opaqueWrite,
        opaqueWrite,
        client,
        opaqueWriteMetadata,
        {
          now: () => new Date('2026-08-01T12:00:00.000Z'),
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
        }
      )
    ).resolves.toMatchObject({ kind: 'read' });
  });
});

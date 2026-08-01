import { describe, expect, it } from 'vitest';
import {
  ProtectedMergeIdentitySchema,
  readProtectedMergeIdentityAuthorityModuleDescriptor,
  verifyProtectedMergeIdentity,
  verifyProtectedMergeIdentityWithAuthority,
} from './cloudflare-evidence-merge-identity';

const mergeSha = 'a'.repeat(40);
const valid = {
  reviewedHeadSha: 'b'.repeat(40),
  requiredChecksSha: 'c'.repeat(40),
  mergeSha,
  mergeMethod: 'squash' as const,
  protectedRef: `refs/tags/storefront-ogabassey-rollout-${mergeSha}-${'d'.repeat(16)}`,
  protectedRefTargetSha: mergeSha,
  protectedTagObjectSha: 'e'.repeat(40),
  reviewId: 'review-123',
  reviewAuthor: 'reviewer',
  requiredCheckRunIds: ['123', '456'],
  requiredCheckNames: ['Build', 'Quality-Gate'],
  artifactManifestSha256: 'f'.repeat(64),
};

describe('protected merge identity', () => {
  it('accepts a tagged merge bound to review and check receipts', () => {
    expect(verifyProtectedMergeIdentity(valid, mergeSha)).toEqual(valid);
  });

  it('rejects a missing, mismatched, or duplicate merge receipt field', () => {
    expect(() => verifyProtectedMergeIdentity({}, mergeSha)).toThrow();
    expect(() =>
      verifyProtectedMergeIdentity(
        { ...valid, protectedRefTargetSha: '1'.repeat(40) },
        mergeSha
      )
    ).toThrow('tagged merge');
    expect(() =>
      verifyProtectedMergeIdentity(
        { ...valid, requiredCheckRunIds: ['123', '123'] },
        mergeSha
      )
    ).toThrow();
    expect(() => verifyProtectedMergeIdentity(valid, '1'.repeat(40))).toThrow(
      'tooling merge SHA'
    );
  });

  it('keeps the schema strict against unreviewed identity fields', () => {
    expect(
      ProtectedMergeIdentitySchema.safeParse({ ...valid, extra: true }).success
    ).toBe(false);
  });

  it('requires an authenticated authority before treating the receipt as protected', async () => {
    await expect(
      verifyProtectedMergeIdentityWithAuthority(valid, mergeSha, undefined)
    ).rejects.toThrow('authenticated');
    await expect(
      verifyProtectedMergeIdentityWithAuthority(valid, mergeSha, async () => {
        throw new Error('authority unavailable');
      })
    ).rejects.toThrow('authority unavailable');
  });

  it('rejects arbitrary check, review, and tag fields against authority readback', async () => {
    const resolveAuthority = async () => valid;
    for (const candidate of [
      { ...valid, requiredChecksSha: '1'.repeat(40) },
      { ...valid, reviewId: 'attacker-review' },
      {
        ...valid,
        protectedTagObjectSha: '2'.repeat(40),
      },
    ])
      await expect(
        verifyProtectedMergeIdentityWithAuthority(
          candidate,
          mergeSha,
          resolveAuthority
        )
      ).rejects.toThrow('authenticated authority');
  });

  it('preserves the valid identity when authenticated authority readback is identical', async () => {
    await expect(
      verifyProtectedMergeIdentityWithAuthority(valid, mergeSha, () => valid)
    ).resolves.toEqual(valid);
  });

  it('rejects malformed authority module descriptors before loading code', async () => {
    await expect(
      import('./cloudflare-evidence-merge-identity').then((module) =>
        module.loadProtectedMergeIdentityAuthority('/workspace', mergeSha, {
          path: 'relative-authority.ts',
          sha256: 'a'.repeat(64),
        })
      )
    ).rejects.toThrow('paths must be absolute');
    await expect(
      import('./cloudflare-evidence-merge-identity').then((module) =>
        module.loadProtectedMergeIdentityAuthority('/workspace', mergeSha, {
          path: '/workspace/authority.ts',
          sha256: 'not-a-sha256',
        })
      )
    ).rejects.toThrow('hash is invalid');
  });

  it('requires both authority module environment fields', () => {
    expect(() =>
      readProtectedMergeIdentityAuthorityModuleDescriptor({})
    ).toThrow('descriptor is required');
    expect(() =>
      readProtectedMergeIdentityAuthorityModuleDescriptor({
        EVIDENCE_PROTECTED_MERGE_AUTHORITY_MODULE: '/workspace/authority.ts',
      })
    ).toThrow('descriptor is required');
  });
});

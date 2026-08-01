import { describe, expect, it } from 'vitest';
import {
  ProtectedMergeIdentitySchema,
  verifyProtectedMergeIdentity,
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
});

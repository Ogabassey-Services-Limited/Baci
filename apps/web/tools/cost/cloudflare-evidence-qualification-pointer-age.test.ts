import { describe, expect, it } from 'vitest';
import {
  calculatePointerCacheCanonicalSha256,
  qualifyCloudflareEvidenceReadback,
} from './cloudflare-evidence-qualification-schemas';
import {
  readback,
  reviewedArtifacts,
} from './qualify-cloudflare-evidence-sources.test-fixtures';

const qualificationOptions = {
  now: new Date('2026-07-31T00:01:00.000Z'),
  expectedArtifacts: [reviewedArtifacts[0], reviewedArtifacts[1]] as const,
  expectedScriptName: readback.scriptName,
  expectedAccountId: 'account',
  expectedOwnerApprovalId: readback.zeroWeightProof.ownerAcceptance.approvalId,
  ownerAcceptanceAuthority: () => readback.zeroWeightProof.ownerAcceptance,
};

describe('qualification pointer-cache freshness bounds', () => {
  it.each([
    Number.POSITIVE_INFINITY,
    Number.NaN,
    -1,
  ])('rejects a non-finite or negative freshness override (%s)', (maximumAgeSeconds) => {
    const result = qualifyCloudflareEvidenceReadback(readback, {
      ...qualificationOptions,
      maximumAgeSeconds,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'pointer_cache_qualification_expired',
    });
  });

  it('caps an oversized finite freshness override at the reviewed maximum', () => {
    const pointerCacheWithoutHash = {
      ...readback.pointerCache,
      qualifiedAt: '2026-07-30T00:00:00.000Z',
      expiresAt: '2026-08-02T00:00:00.000Z',
    };
    const result = qualifyCloudflareEvidenceReadback(
      {
        ...readback,
        pointerCache: {
          ...pointerCacheWithoutHash,
          canonicalSha256: calculatePointerCacheCanonicalSha256(
            pointerCacheWithoutHash
          ),
        },
      },
      {
        ...qualificationOptions,
        now: new Date('2026-07-31T01:00:00.000Z'),
        maximumAgeSeconds: Number.MAX_SAFE_INTEGER,
      }
    );
    expect(result).toEqual({
      ok: false,
      reason: 'pointer_cache_qualification_expired',
    });
  });
});

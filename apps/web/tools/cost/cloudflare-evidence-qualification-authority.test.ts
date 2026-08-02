import { describe, expect, it } from 'vitest';
import {
  matchesQualificationArtifactAuthority,
  matchesQualificationPointerCacheAuthority,
  QualificationArtifactAuthoritySchema,
} from './cloudflare-evidence-qualification-authority';
import {
  reviewedArtifactAuthority,
  reviewedArtifacts,
} from './qualify-cloudflare-evidence-sources.test-fixtures';

describe('reviewed qualification artifact authority', () => {
  it('accepts the two reviewed identities and rejects a source-hash drift', () => {
    expect(
      QualificationArtifactAuthoritySchema.safeParse(reviewedArtifactAuthority)
        .success
    ).toBe(true);
    expect(
      matchesQualificationArtifactAuthority(
        reviewedArtifacts,
        reviewedArtifactAuthority,
        reviewedArtifactAuthority.toolingMergeSha
      )
    ).toBe(true);
    const drifted = {
      ...reviewedArtifactAuthority,
      artifacts: [
        {
          ...reviewedArtifactAuthority.artifacts[0],
          artifactReceipt: {
            ...reviewedArtifactAuthority.artifacts[0].artifactReceipt,
            canonicalSourceSha256: 'f'.repeat(64),
          },
        },
        reviewedArtifactAuthority.artifacts[1],
      ],
    };
    expect(
      matchesQualificationArtifactAuthority(
        reviewedArtifacts,
        drifted,
        reviewedArtifactAuthority.toolingMergeSha
      )
    ).toBe(false);
    expect(
      matchesQualificationPointerCacheAuthority(
        reviewedArtifactAuthority.pointerCache,
        reviewedArtifactAuthority
      )
    ).toBe(true);
    expect(
      matchesQualificationPointerCacheAuthority(
        {
          ...reviewedArtifactAuthority.pointerCache,
          cacheRulesetVersion: 'v2',
        },
        reviewedArtifactAuthority
      )
    ).toBe(false);
  });
});

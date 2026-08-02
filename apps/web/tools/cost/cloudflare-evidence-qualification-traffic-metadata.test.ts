import { describe, expect, it } from 'vitest';
import { validateCloudflareZeroWeightProof } from './cloudflare-evidence-qualification-traffic';
import {
  deployment,
  expectedContract,
  expectedRequestMatrix,
  ownerAcceptanceAuthority,
  proof,
  qualificationNow,
} from './cloudflare-evidence-qualification-traffic.test-fixtures';

describe('Cloudflare protected-override metadata', () => {
  it('rejects candidate traffic whose Version Metadata reports the stable version', () => {
    expect(
      validateCloudflareZeroWeightProof(
        {
          ...proof,
          protectedOverride: {
            ...proof.protectedOverride,
            versionMetadataVersionId: 'a',
          },
        },
        {
          deployment,
          stableVersionId: 'a',
          candidateVersionId: 'b',
          expectedOwnerApprovalId: 'owner-approval',
          ownerAcceptanceAuthority,
          expectedContract,
          expectedRequestMatrix,
          now: qualificationNow,
        }
      )
    ).toEqual({
      ok: false,
      reason: 'protected_override_version_metadata_mismatch',
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  validateCloudflareZeroWeightProof,
  ZeroWeightProofSchema,
} from './cloudflare-evidence-qualification-traffic';
import {
  deployment,
  expectedContract,
  expectedRequestMatrix,
  ownerAcceptanceAuthority,
  proof,
  qualificationNow,
} from './cloudflare-evidence-qualification-traffic.test-fixtures';

describe('Cloudflare zero-weight qualification proof', () => {
  it('accepts exact ordinary, override, contradiction, and owner evidence', () => {
    expect(
      validateCloudflareZeroWeightProof(proof, {
        deployment,
        stableVersionId: 'a',
        candidateVersionId: 'b',
        expectedOwnerApprovalId: 'owner-approval',
        ownerAcceptanceAuthority,
        expectedContract,
        expectedRequestMatrix,
        now: qualificationNow,
      })
    ).toMatchObject({ ok: true });
  });

  it('rejects traffic receipts outside the reviewed request matrix', () => {
    expect(
      validateCloudflareZeroWeightProof(
        {
          ...proof,
          ordinaryTraffic: {
            ...proof.ordinaryTraffic,
            requestSha256: '9'.repeat(64),
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
    ).toEqual({ ok: false, reason: 'zero_weight_request_matrix_mismatch' });
  });

  it('rejects ordinary traffic that records any candidate invocation', () => {
    expect(
      validateCloudflareZeroWeightProof(
        {
          ...proof,
          ordinaryTraffic: { ...proof.ordinaryTraffic, bInvocationCount: 1 },
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
      reason: 'ordinary_traffic_b_invocations_observed',
    });
  });

  it('requires ordinary and protected observations to span the full visibility bound', () => {
    expect(
      validateCloudflareZeroWeightProof(
        {
          ...proof,
          ordinaryTraffic: {
            ...proof.ordinaryTraffic,
            visibilityBoundSeconds: 1,
          },
          protectedOverride: {
            ...proof.protectedOverride,
            visibilityBoundSeconds: 1,
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
      reason: 'zero_weight_visibility_bound_invalid',
    });
  });

  it('rejects a self-consistent contract tuple that differs from reviewed authority', () => {
    expect(
      validateCloudflareZeroWeightProof(
        {
          ...proof,
          productDocumentSha256: '9'.repeat(64),
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
    ).toEqual({ ok: false, reason: 'zero_weight_contract_mismatch' });
  });

  it('rejects an override that lacks candidate Version Metadata', () => {
    expect(
      validateCloudflareZeroWeightProof(
        {
          ...proof,
          protectedOverride: {
            ...proof.protectedOverride,
            servedVersionId: 'a',
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
      reason: 'protected_override_served_wrong_version',
    });
  });

  it('requires the strict proof fields', () => {
    expect(
      ZeroWeightProofSchema.safeParse({
        ...proof,
        ownerAcceptance: { ...proof.ownerAcceptance, accepted: false },
      }).success
    ).toBe(false);
  });

  it('rejects a raw owner receipt without an independently supplied authority', () => {
    expect(
      validateCloudflareZeroWeightProof(proof, {
        deployment,
        stableVersionId: 'a',
        candidateVersionId: 'b',
        expectedOwnerApprovalId: 'owner-approval',
        ownerAcceptanceAuthority: undefined as never,
        expectedContract,
        expectedRequestMatrix,
        now: qualificationNow,
      })
    ).toEqual({
      ok: false,
      reason: 'owner_acceptance_authority_required',
    });
  });

  it('rejects owner acceptance that is stale or differs from the authority readback', () => {
    expect(
      validateCloudflareZeroWeightProof(
        {
          ...proof,
          ownerAcceptance: {
            ...proof.ownerAcceptance,
            acceptedAt: '2026-07-29T00:00:00.000Z',
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
      reason: 'owner_acceptance_mismatch',
    });
    expect(
      validateCloudflareZeroWeightProof(
        {
          ...proof,
          ownerAcceptance: {
            ...proof.ownerAcceptance,
            acceptedAt: '2026-07-29T00:00:00.000Z',
          },
        },
        {
          deployment,
          stableVersionId: 'a',
          candidateVersionId: 'b',
          expectedOwnerApprovalId: 'owner-approval',
          ownerAcceptanceAuthority: () => ({
            ...proof.ownerAcceptance,
            acceptedAt: '2026-07-29T00:00:00.000Z',
          }),
          expectedContract,
          expectedRequestMatrix,
          now: qualificationNow,
        }
      )
    ).toEqual({
      ok: false,
      reason: 'owner_acceptance_stale',
    });
  });

  it('rejects an otherwise valid acceptance replayed against another deployment tuple', () => {
    const otherDeployment = {
      ...deployment,
      deploymentId: 'another-deployment',
    } as const;

    expect(
      validateCloudflareZeroWeightProof(
        { ...proof, deployment: otherDeployment },
        {
          deployment: otherDeployment,
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
      reason: 'owner_acceptance_mismatch',
    });
  });

  it('rejects authoritative acceptance scoped to a different deployment tuple', () => {
    expect(
      validateCloudflareZeroWeightProof(proof, {
        deployment,
        stableVersionId: 'a',
        candidateVersionId: 'b',
        expectedOwnerApprovalId: 'owner-approval',
        ownerAcceptanceAuthority: () => ({
          ...proof.ownerAcceptance,
          deploymentProofSha256: '2'.repeat(64),
        }),
        expectedContract,
        expectedRequestMatrix,
        now: qualificationNow,
      })
    ).toEqual({
      ok: false,
      reason: 'owner_acceptance_mismatch',
    });
  });
});

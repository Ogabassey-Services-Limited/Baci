import { describe, expect, it } from 'vitest';
import {
  calculateCloudflareZeroWeightDeploymentProofSha256,
  validateCloudflareZeroWeightProof,
  ZeroWeightProofSchema,
} from './cloudflare-evidence-qualification-traffic';

const deployment = {
  deploymentId: 'deployment',
  versions: [
    { versionId: 'a', percentage: 100 },
    { versionId: 'b', percentage: 0 },
  ],
} as const;

const proof = {
  zeroWeightDeploymentSupported: true,
  zeroWeightOpenApiContradiction: true,
  productDocumentSha256: 'a'.repeat(64),
  openApiSha256: 'b'.repeat(64),
  openApiMinimumWeight: 0.01,
  visibilityBoundSeconds: 60,
  deployment,
  ordinaryTraffic: {
    requestSha256: 'c'.repeat(64),
    responseSha256: 'd'.repeat(64),
    requestCount: 4,
    aInvocationCount: 4,
    bInvocationCount: 0,
    visibilityBoundSeconds: 60,
    observationStartedAt: '2026-07-31T00:00:00.000Z',
    observationEndedAt: '2026-07-31T00:01:00.000Z',
  },
  protectedOverride: {
    requestSha256: 'e'.repeat(64),
    responseSha256: 'f'.repeat(64),
    requestCount: 1,
    servedVersionId: 'b',
    versionMetadataVersionId: 'b',
    visibilityBoundSeconds: 60,
    observationStartedAt: '2026-07-31T00:00:00.000Z',
    observationEndedAt: '2026-07-31T00:01:00.000Z',
  },
  ownerAcceptance: {
    accepted: true,
    approvalId: 'owner-approval',
    acceptedAt: '2026-07-31T00:00:00.000Z',
    receiptSha256: '1'.repeat(64),
    deploymentProofSha256:
      calculateCloudflareZeroWeightDeploymentProofSha256(deployment),
  },
} as const;
const ownerAcceptanceAuthority = () => proof.ownerAcceptance;
const qualificationNow = new Date('2026-07-31T01:00:00.000Z');

describe('Cloudflare zero-weight qualification proof', () => {
  it('accepts exact ordinary, override, contradiction, and owner evidence', () => {
    expect(
      validateCloudflareZeroWeightProof(proof, {
        deployment,
        stableVersionId: 'a',
        candidateVersionId: 'b',
        expectedOwnerApprovalId: 'owner-approval',
        ownerAcceptanceAuthority,
        now: qualificationNow,
      })
    ).toMatchObject({ ok: true });
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
          now: qualificationNow,
        }
      )
    ).toEqual({
      ok: false,
      reason: 'zero_weight_visibility_bound_invalid',
    });
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
        now: qualificationNow,
      })
    ).toEqual({
      ok: false,
      reason: 'owner_acceptance_mismatch',
    });
  });
});

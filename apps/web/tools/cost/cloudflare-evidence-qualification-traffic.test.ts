import { describe, expect, it } from 'vitest';
import {
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
  },
  protectedOverride: {
    requestSha256: 'e'.repeat(64),
    responseSha256: 'f'.repeat(64),
    requestCount: 1,
    servedVersionId: 'b',
    versionMetadataVersionId: 'b',
    visibilityBoundSeconds: 60,
  },
  ownerAcceptance: {
    accepted: true,
    approvalId: 'owner-approval',
    acceptedAt: '2026-07-31T00:00:00.000Z',
    receiptSha256: '1'.repeat(64),
  },
} as const;

describe('Cloudflare zero-weight qualification proof', () => {
  it('accepts exact ordinary, override, contradiction, and owner evidence', () => {
    expect(
      validateCloudflareZeroWeightProof(proof, {
        deployment,
        stableVersionId: 'a',
        candidateVersionId: 'b',
        expectedOwnerApprovalId: 'owner-approval',
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
        { deployment, stableVersionId: 'a', candidateVersionId: 'b' }
      )
    ).toEqual({
      ok: false,
      reason: 'ordinary_traffic_b_invocations_observed',
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
        { deployment, stableVersionId: 'a', candidateVersionId: 'b' }
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
});

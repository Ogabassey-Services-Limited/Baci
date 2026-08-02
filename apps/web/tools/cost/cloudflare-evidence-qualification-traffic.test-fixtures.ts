import { calculateCloudflareZeroWeightDeploymentProofSha256 } from './cloudflare-evidence-qualification-traffic';

export const deployment = {
  deploymentId: 'deployment',
  versions: [
    { versionId: 'a', percentage: 100 },
    { versionId: 'b', percentage: 0 },
  ],
} as const;

export const proof = {
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

export const ownerAcceptanceAuthority = () => proof.ownerAcceptance;
export const expectedContract = {
  zeroWeightDeploymentSupported: proof.zeroWeightDeploymentSupported,
  zeroWeightOpenApiContradiction: proof.zeroWeightOpenApiContradiction,
  productDocumentSha256: proof.productDocumentSha256,
  openApiSha256: proof.openApiSha256,
  openApiMinimumWeight: proof.openApiMinimumWeight,
  visibilityBoundSeconds: proof.visibilityBoundSeconds,
};
export const expectedRequestMatrix = {
  ordinaryRequestSha256: proof.ordinaryTraffic.requestSha256,
  ordinaryResponseSha256: proof.ordinaryTraffic.responseSha256,
  ordinaryRequestCount: proof.ordinaryTraffic.requestCount,
  protectedOverrideRequestSha256: proof.protectedOverride.requestSha256,
  protectedOverrideResponseSha256: proof.protectedOverride.responseSha256,
  protectedOverrideRequestCount: proof.protectedOverride.requestCount,
};
export const qualificationNow = new Date('2026-07-31T01:00:00.000Z');

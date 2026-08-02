import { describe, expect, it } from 'vitest';
import {
  validateCloudflareZeroWeightProof,
  ZeroWeightProofSchema,
} from './cloudflare-evidence-qualification-traffic';
import { readback } from './qualify-cloudflare-evidence-sources.test-fixtures';

const proof = readback.zeroWeightProof;
const deployment = readback.deployments;
const expectedContract = {
  zeroWeightDeploymentSupported: proof.zeroWeightDeploymentSupported,
  zeroWeightOpenApiContradiction: proof.zeroWeightOpenApiContradiction,
  productDocumentSha256: proof.productDocumentSha256,
  openApiSha256: proof.openApiSha256,
  openApiMinimumWeight: proof.openApiMinimumWeight,
  visibilityBoundSeconds: proof.visibilityBoundSeconds,
};
const options = {
  deployment,
  stableVersionId: 'a',
  candidateVersionId: 'b',
  expectedOwnerApprovalId: 'owner-approval',
  ownerAcceptanceAuthority: () => proof.ownerAcceptance,
  expectedContract,
  now: new Date('2026-07-31T01:00:00.000Z'),
} as const;

describe('Cloudflare zero-weight observation windows', () => {
  it('rejects ordinary observations that cover less than the bound', () => {
    expect(
      validateCloudflareZeroWeightProof(
        {
          ...proof,
          ordinaryTraffic: {
            ...proof.ordinaryTraffic,
            observationEndedAt: '2026-07-31T00:00:59.999Z',
          },
        },
        options
      )
    ).toEqual({
      ok: false,
      reason: 'zero_weight_observation_window_invalid',
    });
  });

  it('rejects protected override observations that cover less than the bound', () => {
    expect(
      validateCloudflareZeroWeightProof(
        {
          ...proof,
          protectedOverride: {
            ...proof.protectedOverride,
            observationEndedAt: '2026-07-31T00:00:59.999Z',
          },
        },
        options
      )
    ).toEqual({
      ok: false,
      reason: 'zero_weight_observation_window_invalid',
    });
  });

  it('requires provider observation timestamps in both receipts', () => {
    expect(
      ZeroWeightProofSchema.safeParse({
        ...proof,
        ordinaryTraffic: {
          ...proof.ordinaryTraffic,
          observationStartedAt: undefined,
        },
      }).success
    ).toBe(false);
  });

  it('rejects observations before acceptance or after qualification time', () => {
    const invalidWindows = [
      {
        observationStartedAt: '2026-07-30T23:59:00.000Z',
        observationEndedAt: '2026-07-31T00:00:00.000Z',
      },
      {
        observationStartedAt: '2026-07-31T01:00:00.000Z',
        observationEndedAt: '2026-07-31T01:01:00.000Z',
      },
    ];
    for (const field of ['ordinaryTraffic', 'protectedOverride'] as const)
      for (const invalidWindow of invalidWindows)
        expect(
          validateCloudflareZeroWeightProof(
            { ...proof, [field]: { ...proof[field], ...invalidWindow } },
            options
          )
        ).toEqual({
          ok: false,
          reason: 'zero_weight_observation_not_current_run',
        });
  });
});

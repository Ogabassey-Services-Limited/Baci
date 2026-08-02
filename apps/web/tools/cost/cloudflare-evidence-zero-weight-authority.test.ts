import { describe, expect, it } from 'vitest';
import {
  matchesReviewedZeroWeightContract,
  observationsAreWithinCurrentRun,
  spansVisibilityBound,
} from './cloudflare-evidence-zero-weight-authority';

const reviewedContract = {
  zeroWeightDeploymentSupported: true,
  zeroWeightOpenApiContradiction: true,
  productDocumentSha256: 'a'.repeat(64),
  openApiSha256: 'b'.repeat(64),
  openApiMinimumWeight: 0.01,
  visibilityBoundSeconds: 60,
} as const;

describe('Cloudflare zero-weight authority', () => {
  it('requires proof to match the independently reviewed contract', () => {
    expect(
      matchesReviewedZeroWeightContract(reviewedContract, reviewedContract)
    ).toBeUndefined();
    expect(
      matchesReviewedZeroWeightContract(
        { ...reviewedContract, visibilityBoundSeconds: 1 },
        reviewedContract
      )
    ).toBe('mismatch');
    expect(matchesReviewedZeroWeightContract(reviewedContract, undefined)).toBe(
      'authority_required'
    );
  });

  it('rejects observation windows outside the active run', () => {
    const acceptedAtMs = Date.parse('2026-07-31T00:00:00.000Z');
    const nowMs = Date.parse('2026-07-31T00:02:00.000Z');

    expect(
      observationsAreWithinCurrentRun(
        [
          {
            observationStartedAt: '2026-07-31T00:00:00.000Z',
            observationEndedAt: '2026-07-31T00:01:00.000Z',
          },
        ],
        acceptedAtMs,
        nowMs
      )
    ).toBe(true);
    expect(
      observationsAreWithinCurrentRun(
        [
          {
            observationStartedAt: '2026-07-30T23:59:59.999Z',
            observationEndedAt: '2026-07-31T00:01:00.000Z',
          },
        ],
        acceptedAtMs,
        nowMs
      )
    ).toBe(false);
    expect(
      observationsAreWithinCurrentRun(
        [
          {
            observationStartedAt: '2026-07-31T00:01:00.000Z',
            observationEndedAt: '2026-07-31T00:02:00.001Z',
          },
        ],
        acceptedAtMs,
        nowMs
      )
    ).toBe(false);
  });

  it('requires each observation to span its reviewed visibility bound', () => {
    expect(
      spansVisibilityBound({
        observationStartedAt: '2026-07-31T00:00:00.000Z',
        observationEndedAt: '2026-07-31T00:01:00.000Z',
        visibilityBoundSeconds: 60,
      })
    ).toBe(true);
    expect(
      spansVisibilityBound({
        observationStartedAt: '2026-07-31T00:00:00.000Z',
        observationEndedAt: '2026-07-31T00:00:59.999Z',
        visibilityBoundSeconds: 60,
      })
    ).toBe(false);
  });
});

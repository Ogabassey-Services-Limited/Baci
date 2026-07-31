import { describe, expect, it } from 'vitest';
import { StorefrontDeliveryDailyEvidenceSchema } from './delivery-evidence';

const dailyEvidence = {
  utcDate: '2026-07-01',
  hostnameInventorySha256: 'a'.repeat(64),
  eligibilityPolicySha256: 'b'.repeat(64),
  aliasRulesetVersion: 'alias-v1',
  wafRulesetVersion: 'waf-v1',
  workerDeploymentId: 'deployment-v1',
  originOnlyVersionId: 'origin-v1',
  edgeVersionId: 'edge-v1',
  source: 'worker-analytics',
  exportedAt: '2026-07-02T00:00:00.000Z',
  providerSamplingApplied: false,
  maxSampleInterval: 1,
  exportComplete: true,
  invocationCountExact: true,
  workerInvocationCount: 1000,
  totalDecisionCount: 1000,
  canonicalEligibleRequestCount: 1000,
  canonicalEligibleOriginAttemptCount: 0,
  dynamicOriginAttemptCount: 0,
  unknownOriginAttemptCount: 0,
  edgeReleaseCount: 1000,
  edgeRejectCount: 0,
  terminalCount: 0,
  edgeErrorCount: 0,
  aliasEligibleRequestCount: 0,
  aliasEdgeRedirectCount: 0,
  aliasEligibleOriginRequestCount: 0,
  aliasDynamicOriginCount: 0,
  rejectedMethodRequestCount: 0,
  rejectedMethodOriginCount: 0,
  allowedOriginRateLimitCount: 0,
  sha256: 'c'.repeat(64),
};

describe('StorefrontDeliveryDailyEvidenceSchema', () => {
  it('accepts bounded aggregate evidence and rejects raw request rows', () => {
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse(dailyEvidence).success
    ).toBe(true);
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse({
        ...dailyEvidence,
        rawRequests: [],
      }).success
    ).toBe(false);
  });

  it('rejects fractional, negative, or malformed aggregate fields', () => {
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse({
        ...dailyEvidence,
        workerInvocationCount: 1.5,
      }).success
    ).toBe(false);
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse({
        ...dailyEvidence,
        edgeErrorCount: -1,
      }).success
    ).toBe(false);
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse({
        ...dailyEvidence,
        sha256: 'not-a-hash',
      }).success
    ).toBe(false);
  });
});

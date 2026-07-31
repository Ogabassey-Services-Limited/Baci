import { describe, expect, it } from 'vitest';
import {
  canonicalizeJson,
  calculateCanonicalSha256,
  calculateStorefrontDeliveryDailyEvidenceSha256,
  StorefrontDeliveryDailyEvidenceSchema,
} from './delivery-evidence';

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
  sourceEvidence: {
    invocation: {
      sourceFingerprint: 'invocation-v1',
      complete: true,
      exact: true,
      providerSamplingApplied: false,
      maxSampleInterval: 1,
    },
    aliasRedirect: {
      sourceFingerprint: 'alias-v1',
      complete: true,
      exact: true,
      providerSamplingApplied: false,
      maxSampleInterval: 1,
    },
    wafRateLimit: {
      sourceFingerprint: 'waf-v1',
      complete: true,
      exact: true,
      providerSamplingApplied: false,
      maxSampleInterval: 1,
    },
    originEvent: {
      sourceFingerprint: 'origin-v1',
      complete: true,
      exact: true,
      providerSamplingApplied: false,
      maxSampleInterval: 1,
    },
  },
  sha256: '',
};
dailyEvidence.sha256 =
  calculateStorefrontDeliveryDailyEvidenceSha256(dailyEvidence);

describe('StorefrontDeliveryDailyEvidenceSchema', () => {
  it('uses the canonical SHA-256 digest rather than a runtime-specific hash provider', () => {
    expect(calculateCanonicalSha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });
  it('sorts object keys recursively, preserves arrays, and rejects ambiguous values', () => {
    expect(canonicalizeJson({ b: { z: 1, a: 2 }, a: [2, 1] })).toBe(
      canonicalizeJson({ a: [2, 1], b: { a: 2, z: 1 } })
    );
    expect(canonicalizeJson({ a: [2, 1] })).not.toBe(
      canonicalizeJson({ a: [1, 2] })
    );
    expect(() => canonicalizeJson({ value: undefined })).toThrow('unsupported');
    expect(() => canonicalizeJson({ value: Number.NaN })).toThrow(
      'unsupported'
    );
  });
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
  it('requires each independent source to be exact, complete, and unsampled', () => {
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse({
        ...dailyEvidence,
        sourceEvidence: {
          ...dailyEvidence.sourceEvidence,
          wafRateLimit: {
            ...dailyEvidence.sourceEvidence.wafRateLimit,
            exact: false,
          },
        },
      }).success
    ).toBe(true);
  });
});

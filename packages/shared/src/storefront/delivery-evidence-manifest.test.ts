import { describe, expect, it } from 'vitest';
import { calculateStorefrontDeliveryDailyEvidenceSha256 } from './delivery-evidence';
import {
  calculateHostnameInventorySha256,
  validateStorefrontDeliveryManifest,
} from './delivery-evidence-manifest';

const dailyEvidence = {
  utcDate: '2026-07-01',
  hostnameInventorySha256: 'a'.repeat(64),
  eligibilityPolicySha256: 'b'.repeat(64),
  aliasRulesetVersion: 'alias-v1',
  wafRulesetVersion: 'waf-v1',
  workerDeploymentId: 'deployment-v1',
  originOnlyVersionId: 'origin-v1',
  edgeVersionId: 'edge-v1',
  source: 'worker-analytics' as const,
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

function sevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const day = {
      ...dailyEvidence,
      utcDate: `2026-07-0${index + 1}`,
      sha256: '',
    };
    day.sha256 = calculateStorefrontDeliveryDailyEvidenceSha256(day);
    return day;
  });
}

const manifest = () => {
  const hostnameInventorySha256 = calculateHostnameInventorySha256([
    'ogabassey.com',
    'www.ogabassey.com',
  ]);
  const days = sevenDays().map((day) => {
    const next = { ...day, hostnameInventorySha256, sha256: '' };
    next.sha256 = calculateStorefrontDeliveryDailyEvidenceSha256(next);
    return next;
  });
  return {
    windowStart: '2026-07-01T00:00:00.000Z',
    windowEnd: '2026-07-08T00:00:00.000Z',
    canonicalHostname: 'ogabassey.com' as const,
    aliasHostnames: ['www.ogabassey.com'],
    inventoryHostnames: ['ogabassey.com', 'www.ogabassey.com'],
    hostnameInventorySha256,
    eligibilityPolicySha256: 'b'.repeat(64),
    aliasRulesetVersion: 'alias-v1',
    wafRulesetVersion: 'waf-v1',
    workerDeploymentId: 'deployment-v1',
    originOnlyVersionId: 'origin-v1',
    edgeVersionId: 'edge-v1',
    days,
  };
};

describe('validateStorefrontDeliveryManifest', () => {
  it('accepts exactly seven contiguous closed UTC days', () =>
    expect(validateStorefrontDeliveryManifest(manifest()).ok).toBe(true));
  it('rejects a missing day and an unsorted or omitted hostname partition', () => {
    expect(
      validateStorefrontDeliveryManifest({
        ...manifest(),
        days: sevenDays().slice(1),
      }).ok
    ).toBe(false);
    expect(
      validateStorefrontDeliveryManifest({
        ...manifest(),
        aliasHostnames: ['www.ogabassey.com'],
        inventoryHostnames: ['ogabassey.com'],
      }).ok
    ).toBe(false);
  });
  it('rejects tampered daily or canonical hostname-inventory hashes', () => {
    const tamperedDay = manifest();
    tamperedDay.days[0].sha256 = 'f'.repeat(64);
    expect(validateStorefrontDeliveryManifest(tamperedDay).ok).toBe(false);
    expect(
      validateStorefrontDeliveryManifest({
        ...manifest(),
        hostnameInventorySha256: 'f'.repeat(64),
      }).ok
    ).toBe(false);
  });
});

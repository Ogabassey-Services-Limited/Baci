import { describe, expect, it } from 'vitest';
import { validateStorefrontDeliveryManifest } from './delivery-evidence-manifest';

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
  sha256: 'c'.repeat(64),
};

function sevenDays() {
  return Array.from({ length: 7 }, (_, index) => ({
    ...dailyEvidence,
    utcDate: `2026-07-0${index + 1}`,
    sha256: String(index).padStart(64, '0'),
  }));
}

const manifest = () => ({
  windowStart: '2026-07-01T00:00:00.000Z',
  windowEnd: '2026-07-08T00:00:00.000Z',
  canonicalHostname: 'ogabassey.com' as const,
  aliasHostnames: ['www.ogabassey.com'],
  inventoryHostnames: ['ogabassey.com', 'www.ogabassey.com'],
  hostnameInventorySha256: 'a'.repeat(64),
  eligibilityPolicySha256: 'b'.repeat(64),
  aliasRulesetVersion: 'alias-v1',
  wafRulesetVersion: 'waf-v1',
  workerDeploymentId: 'deployment-v1',
  originOnlyVersionId: 'origin-v1',
  edgeVersionId: 'edge-v1',
  days: sevenDays(),
});

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
});

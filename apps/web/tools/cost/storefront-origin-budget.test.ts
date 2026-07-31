import { describe, expect, it } from 'vitest';
import { summarizeStorefrontDelivery } from './storefront-origin-budget';

const hash = (letter: string) => letter.repeat(64);
function manifest(overrides: Record<string, unknown> = {}) {
  const days = Array.from({ length: 7 }, (_, index) => ({
    utcDate: `2026-07-0${index + 1}`,
    hostnameInventorySha256: hash('a'),
    eligibilityPolicySha256: hash('b'),
    aliasRulesetVersion: 'alias-v1',
    wafRulesetVersion: 'waf-v1',
    workerDeploymentId: 'deployment-v1',
    originOnlyVersionId: 'origin-v1',
    edgeVersionId: 'edge-v1',
    source: 'worker-analytics',
    exportedAt: '2026-07-08T00:00:00.000Z',
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
    sha256: hash(String(index)),
  }));
  return {
    windowStart: '2026-07-01T00:00:00.000Z',
    windowEnd: '2026-07-08T00:00:00.000Z',
    canonicalHostname: 'ogabassey.com' as const,
    aliasHostnames: ['www.ogabassey.com'],
    inventoryHostnames: ['ogabassey.com', 'www.ogabassey.com'],
    hostnameInventorySha256: hash('a'),
    eligibilityPolicySha256: hash('b'),
    aliasRulesetVersion: 'alias-v1',
    wafRulesetVersion: 'waf-v1',
    workerDeploymentId: 'deployment-v1',
    originOnlyVersionId: 'origin-v1',
    edgeVersionId: 'edge-v1',
    days,
    ...overrides,
  };
}

describe('summarizeStorefrontDelivery', () => {
  it('passes a complete seven-day all-ingress census with zero origins', () =>
    expect(summarizeStorefrontDelivery(manifest()).verdict).toBe('PASS'));
  it('uses canonical plus alias ingress for the threshold equation', () => {
    const evidence = manifest();
    evidence.days[0] = {
      ...evidence.days[0],
      canonicalEligibleRequestCount: 500,
      aliasEligibleRequestCount: 500,
      aliasEdgeRedirectCount: 500,
      canonicalEligibleOriginAttemptCount: 1,
    };
    for (const day of evidence.days.slice(1)) {
      day.canonicalEligibleRequestCount = 0;
      day.workerInvocationCount = 0;
      day.totalDecisionCount = 0;
      day.edgeReleaseCount = 0;
    }
    expect(summarizeStorefrontDelivery(evidence).originRate).toBe(0.001);
    expect(summarizeStorefrontDelivery(evidence).verdict).toBe('PASS');
  });
  it('fails above 1/1000 and for any unknown, alias, or rejected-method origin attempt', () => {
    const over = manifest();
    over.days[0].canonicalEligibleOriginAttemptCount = 8;
    expect(summarizeStorefrontDelivery(over).verdict).toBe('FAIL');
    const unknown = manifest();
    unknown.days[0].unknownOriginAttemptCount = 1;
    expect(summarizeStorefrontDelivery(unknown).verdict).toBe('FAIL');
    const alias = manifest();
    alias.days[0].aliasEligibleOriginRequestCount = 1;
    expect(summarizeStorefrontDelivery(alias).verdict).toBe('FAIL');
    const rejected = manifest();
    rejected.days[0].rejectedMethodOriginCount = 1;
    expect(summarizeStorefrontDelivery(rejected).verdict).toBe('FAIL');
  });
  it('does not erase an origin attempt when delivery ends as edge-error', () => {
    const evidence = manifest();
    evidence.days[0] = {
      ...evidence.days[0],
      canonicalEligibleOriginAttemptCount: 1,
      edgeErrorCount: 1,
    };
    expect(
      summarizeStorefrontDelivery(evidence).canonicalEligibleOriginAttempts
    ).toBe(1);
  });
  it('returns not proven for sampling, count mismatch, alias redirect mismatch, missing day, config drift, or zero ingress', () => {
    for (const change of [
      (m: ReturnType<typeof manifest>) => {
        m.days[0].maxSampleInterval = 2;
      },
      (m: ReturnType<typeof manifest>) => {
        m.days[0].totalDecisionCount = 999;
      },
      (m: ReturnType<typeof manifest>) => {
        m.days[0].aliasEligibleRequestCount = 1;
      },
      (m: ReturnType<typeof manifest>) => {
        m.days.pop();
      },
      (m: ReturnType<typeof manifest>) => {
        m.days[0].wafRulesetVersion = 'drift';
      },
      (m: ReturnType<typeof manifest>) =>
        m.days.forEach((day) => {
          day.canonicalEligibleRequestCount = 0;
          day.aliasEligibleRequestCount = 0;
        }),
    ]) {
      const evidence = manifest();
      change(evidence);
      expect(summarizeStorefrontDelivery(evidence).verdict).toBe('NOT_PROVEN');
    }
  });
});

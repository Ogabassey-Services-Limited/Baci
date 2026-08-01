import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { calculateStorefrontDeliveryDailyEvidenceSha256 } from '../../../../packages/shared/src/storefront/delivery-evidence';
import {
  calculateHostnameInventorySha256,
  calculateStorefrontDeliveryWindowFingerprintSha256,
} from '../../../../packages/shared/src/storefront/delivery-evidence-manifest';
import {
  readSealedStorefrontDeliveryManifest,
  summarizeStorefrontDelivery,
} from './storefront-origin-budget';

const hash = (letter: string) => letter.repeat(64);
const validationNow = new Date('2026-08-02T12:00:00.000Z');
const summarizeAtFixtureTime = (
  value: unknown,
  options: { thresholdOverride?: number } = {}
) => summarizeStorefrontDelivery(value, { ...options, now: validationNow });

function manifest(overrides: Record<string, unknown> = {}) {
  const hostnameInventorySha256 = calculateHostnameInventorySha256([
    'ogabassey.com',
    'ogabassey.usebaci.com',
    'www.ogabassey.com',
  ]);
  const days = Array.from({ length: 7 }, (_, index) => {
    const utcDate = new Date(Date.UTC(2026, 6, 25 + index))
      .toISOString()
      .slice(0, 10);
    const day = {
      utcDate,
      hostnameInventorySha256,
      eligibilityPolicySha256: hash('b'),
      aliasRulesetVersion: 'alias-v1',
      wafRulesetVersion: 'waf-v1',
      responseHeaderRulesetSha256: hash('c'),
      rawOriginRobotsTxtSha256: hash('d'),
      workerDeploymentId: 'deployment-v1',
      originOnlyVersionId: 'origin-v1',
      edgeVersionId: 'edge-v1',
      source: 'worker-analytics',
      exportedAt: new Date(Date.UTC(2026, 6, 26 + index)).toISOString(),
      providerSamplingApplied: false,
      maxSampleInterval: 1,
      exportComplete: true,
      invocationCountExact: true,
      workerInvocationCount: 1000,
      totalDecisionCount: 1000,
      syntheticQualificationRequestCount: 0,
      canonicalEligibleRequestCount: 1000,
      canonicalEligibleOriginAttemptCount: 0,
      dynamicOriginAttemptCount: 0,
      unknownOriginAttemptCount: 0,
      edgeReleaseCount: 1000,
      edgeRejectCount: 0,
      originFallbackCount: 0,
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
          sourceFingerprint: hash('1'),
          complete: true,
          exact: true,
          providerSamplingApplied: false,
          maxSampleInterval: 1,
        },
        aliasRedirect: {
          sourceFingerprint: hash('2'),
          complete: true,
          exact: true,
          providerSamplingApplied: false,
          maxSampleInterval: 1,
        },
        wafRateLimit: {
          sourceFingerprint: hash('3'),
          complete: true,
          exact: true,
          providerSamplingApplied: false,
          maxSampleInterval: 1,
        },
        originEvent: {
          sourceFingerprint: hash('4'),
          requestCount: 0,
          complete: true,
          exact: true,
          providerSamplingApplied: false,
          maxSampleInterval: 1,
        },
        syntheticQualification: {
          sourceFingerprint: hash('5'),
          requestCount: 0,
          complete: true,
          exact: true,
          providerSamplingApplied: false,
          maxSampleInterval: 1,
        },
      },
      sha256: '',
    };
    day.sha256 = calculateStorefrontDeliveryDailyEvidenceSha256(day);
    return day;
  });
  const base = {
    windowStart: '2026-07-25T00:00:00.000Z',
    windowEnd: '2026-08-01T00:00:00.000Z',
    canonicalHostname: 'ogabassey.com' as const,
    aliasHostnames: ['ogabassey.usebaci.com', 'www.ogabassey.com'],
    inventoryHostnames: [
      'ogabassey.com',
      'ogabassey.usebaci.com',
      'www.ogabassey.com',
    ],
    hostnameInventorySha256,
    eligibilityPolicySha256: hash('b'),
    aliasRulesetVersion: 'alias-v1',
    wafRulesetVersion: 'waf-v1',
    responseHeaderRulesetSha256: hash('c'),
    rawOriginRobotsTxtSha256: hash('d'),
    workerDeploymentId: 'deployment-v1',
    originOnlyVersionId: 'origin-v1',
    edgeVersionId: 'edge-v1',
    sourceFingerprints: {
      invocation: hash('1'),
      aliasRedirect: hash('2'),
      wafRateLimit: hash('3'),
      originEvent: hash('4'),
      syntheticQualification: hash('5'),
    },
    evidenceSource: 'worker-analytics' as const,
    days,
    ...overrides,
  };
  return {
    ...base,
    windowFingerprintSha256:
      calculateStorefrontDeliveryWindowFingerprintSha256(base),
  };
}
function seal<T extends ReturnType<typeof manifest>>(evidence: T) {
  for (const day of evidence.days)
    day.sha256 = calculateStorefrontDeliveryDailyEvidenceSha256(day);
  evidence.windowFingerprintSha256 =
    calculateStorefrontDeliveryWindowFingerprintSha256(evidence);
  return evidence;
}
function withSyntheticProjection(
  evidence: ReturnType<typeof manifest>,
  requestCount: number,
  sourceRequestCount = requestCount,
  canonicalRequestCount = 1000
) {
  const day = evidence.days[0];
  day.canonicalEligibleRequestCount = canonicalRequestCount;
  day.syntheticQualificationRequestCount = requestCount;
  day.sourceEvidence.syntheticQualification.requestCount = sourceRequestCount;
  return evidence;
}

describe('summarizeStorefrontDelivery', () => {
  it('passes a complete seven-day all-ingress census with zero origins', () =>
    expect(summarizeAtFixtureTime(manifest()).verdict).toBe('PASS'));
  it('excludes independently reconciled synthetic qualification probes from real ingress', () => {
    const summary = summarizeAtFixtureTime(
      seal(withSyntheticProjection(manifest(), 10, 10, 990))
    );
    expect(summary.syntheticQualificationRequests).toBe(10);
    expect(summary.allEligibleIngress).toBe(6990);
    expect(summary.verdict).toBe('PASS');
  });
  it('returns not proven when synthetic probes are included in canonical eligibility', () => {
    expect(
      summarizeAtFixtureTime(seal(withSyntheticProjection(manifest(), 10)))
        .verdict
    ).toBe('NOT_PROVEN');
    expect(
      summarizeAtFixtureTime(
        seal(withSyntheticProjection(manifest(), 10, 9, 990))
      ).verdict
    ).toBe('NOT_PROVEN');
  });
  it('uses canonical plus alias ingress for the threshold equation', () => {
    const evidence = manifest();
    evidence.days[0] = {
      ...evidence.days[0],
      canonicalEligibleRequestCount: 500,
      aliasEligibleRequestCount: 500,
      aliasEdgeRedirectCount: 500,
      canonicalEligibleOriginAttemptCount: 1,
      sourceEvidence: {
        ...evidence.days[0].sourceEvidence,
        originEvent: {
          ...evidence.days[0].sourceEvidence.originEvent,
          requestCount: 1,
        },
      },
    };
    for (const day of evidence.days.slice(1)) {
      day.canonicalEligibleRequestCount = 0;
      day.workerInvocationCount = 0;
      day.totalDecisionCount = 0;
      day.edgeReleaseCount = 0;
    }
    expect(summarizeAtFixtureTime(seal(evidence)).originRate).toBe(0.001);
    expect(summarizeAtFixtureTime(seal(evidence)).verdict).toBe('PASS');
  });
  it('applies a comparison threshold and rejects an impossible eligibility denominator', () => {
    const comparison = manifest();
    comparison.days[0].canonicalEligibleOriginAttemptCount = 50;
    comparison.days[0].sourceEvidence.originEvent.requestCount = 50;
    expect(
      summarizeAtFixtureTime(seal(comparison), {
        thresholdOverride: 0.1,
      }).verdict
    ).toBe('PASS');
    const malformed = manifest();
    malformed.days[0].canonicalEligibleRequestCount = 1001;
    expect(summarizeAtFixtureTime(seal(malformed)).verdict).toBe('NOT_PROVEN');
  });
  it('fails above 1/1000 and for any unknown, alias, or rejected-method origin attempt', () => {
    const over = manifest();
    over.days[0].canonicalEligibleOriginAttemptCount = 8;
    over.days[0].sourceEvidence.originEvent.requestCount = 8;
    expect(summarizeAtFixtureTime(seal(over)).verdict).toBe('FAIL');
    const unknown = manifest();
    unknown.days[0].unknownOriginAttemptCount = 1;
    unknown.days[0].sourceEvidence.originEvent.requestCount = 1;
    expect(summarizeAtFixtureTime(seal(unknown)).verdict).toBe('FAIL');
    const alias = manifest();
    alias.days[0].aliasEligibleOriginRequestCount = 1;
    alias.days[0].sourceEvidence.originEvent.requestCount = 1;
    expect(summarizeAtFixtureTime(seal(alias)).verdict).toBe('FAIL');
    const rejected = manifest();
    rejected.days[0].rejectedMethodOriginCount = 1;
    rejected.days[0].sourceEvidence.originEvent.requestCount = 1;
    expect(summarizeAtFixtureTime(seal(rejected)).verdict).toBe('FAIL');
  });
  it('does not pass when the independent origin-event count understates classified attempts', () => {
    const evidence = manifest();
    evidence.days[0].canonicalEligibleOriginAttemptCount = 1;
    const summary = summarizeAtFixtureTime(seal(evidence));
    expect(summary.originEventRequests).toBe(0);
    expect(summary.classifiedOriginAttempts).toBe(1);
    expect(summary.originEventReconciled).toBe(false);
    expect(summary.verdict).toBe('NOT_PROVEN');
  });
  it('reconciles the independent origin-event count before applying the rate gate', () => {
    const evidence = manifest();
    evidence.days[0].canonicalEligibleOriginAttemptCount = 1;
    evidence.days[0].sourceEvidence.originEvent.requestCount = 1;
    const summary = summarizeAtFixtureTime(seal(evidence));
    expect(summary.originEventRequests).toBe(1);
    expect(summary.classifiedOriginAttempts).toBe(1);
    expect(summary.originEventReconciled).toBe(true);
    expect(summary.verdict).toBe('PASS');
  });
  it('does not pass when dynamic or rate-limit origin events are outside the static equation', () => {
    for (const change of [
      (evidence: ReturnType<typeof manifest>) => {
        evidence.days[0].dynamicOriginAttemptCount = 1;
        evidence.days[0].sourceEvidence.originEvent.requestCount = 1;
      },
      (evidence: ReturnType<typeof manifest>) => {
        evidence.days[0].aliasDynamicOriginCount = 1;
        evidence.days[0].sourceEvidence.originEvent.requestCount = 1;
      },
      (evidence: ReturnType<typeof manifest>) => {
        evidence.days[0].allowedOriginRateLimitCount = 1;
        evidence.days[0].sourceEvidence.originEvent.requestCount = 1;
      },
    ]) {
      const evidence = manifest();
      change(evidence);
      const summary = summarizeAtFixtureTime(seal(evidence));
      expect(summary.verdict).toBe('NOT_PROVEN');
      expect(summary.evidenceComplete).toBe(false);
      expect(summary.unaccountedOriginAttempts).toBe(1);
    }
  });
  it('does not erase an origin attempt when delivery ends as edge-error', () => {
    const evidence = manifest();
    evidence.days[0] = {
      ...evidence.days[0],
      canonicalEligibleOriginAttemptCount: 1,
      edgeErrorCount: 1,
      sourceEvidence: {
        ...evidence.days[0].sourceEvidence,
        originEvent: {
          ...evidence.days[0].sourceEvidence.originEvent,
          requestCount: 1,
        },
      },
    };
    expect(
      summarizeAtFixtureTime(seal(evidence)).canonicalEligibleOriginAttempts
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
      expect(summarizeAtFixtureTime(seal(evidence)).verdict).toBe('NOT_PROVEN');
    }
  });
  it('returns not proven when decision classifications do not reconcile with invocations', () => {
    const malformed = manifest();
    malformed.days[0].edgeReleaseCount = 0;
    expect(summarizeAtFixtureTime(seal(malformed)).verdict).toBe('NOT_PROVEN');
  });
  it('returns not proven when an independent source is estimated, incomplete, or sampled', () => {
    const evidence = manifest();
    evidence.days[0].sourceEvidence.originEvent.exact = false;
    expect(summarizeAtFixtureTime(seal(evidence)).verdict).toBe('NOT_PROVEN');
  });
  it('reads only an audited sealed manifest and rejects production threshold overrides', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'baci-manifest-'));
    await chmod(directory, 0o700);
    const path = join(directory, 'sealed.json');
    await writeFile(path, JSON.stringify(manifest()), { mode: 0o600 });
    await expect(
      readSealedStorefrontDeliveryManifest(path, {
        environment: 'production',
        now: validationNow,
      })
    ).resolves.toMatchObject({ canonicalHostname: 'ogabassey.com' });
    await expect(
      readSealedStorefrontDeliveryManifest(path, {
        environment: 'production',
        thresholdOverride: 0.1,
      })
    ).rejects.toThrow('overrides');
  });
});

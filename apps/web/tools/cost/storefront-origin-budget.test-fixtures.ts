import {
  calculateHostnameInventorySha256,
  calculateStorefrontDeliveryDailyEvidenceSha256,
  calculateStorefrontDeliveryWindowFingerprintSha256,
} from '@baci/shared/storefront';
import { summarizeStorefrontDelivery } from './storefront-origin-budget';

const hash = (letter: string) => letter.repeat(64);
export const validationNow = new Date('2026-08-02T12:00:00.000Z');
export const summarizeAtFixtureTime = (
  value: unknown,
  options: { thresholdOverride?: number } = {}
) => summarizeStorefrontDelivery(value, { ...options, now: validationNow });

export function manifest(overrides: Record<string, unknown> = {}) {
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
      aliasRawRequestCount: 0,
      aliasEligibleRequestCount: 0,
      aliasEdgeRedirectCount: 0,
      aliasEligibleOriginRequestCount: 0,
      aliasDynamicOriginCount: 0,
      rejectedMethodRequestCount: 0,
      rejectedMethodOriginCount: 0,
      allowedOriginRateLimitCount: 0,
      trafficPartition: [
        {
          hostname: 'ogabassey.com',
          methodClass: 'GET_HEAD',
          pathClass: 'document',
          ruleId: 'worker-static',
          requestCount: 1000,
          eligibleRequestCount: 1000,
          eligibleOriginAttemptCount: 0,
        },
        {
          hostname: 'ogabassey.usebaci.com',
          methodClass: 'GET_HEAD',
          pathClass: 'document',
          ruleId: 'alias-static',
          requestCount: 0,
          eligibleRequestCount: 0,
          eligibleOriginAttemptCount: 0,
        },
        {
          hostname: 'www.ogabassey.com',
          methodClass: 'GET_HEAD',
          pathClass: 'document',
          ruleId: 'alias-static',
          requestCount: 0,
          eligibleRequestCount: 0,
          eligibleOriginAttemptCount: 0,
        },
      ],
      sourceEvidence: {
        invocation: {
          sourceFingerprint: hash('1'),
          requestCount: 1000,
          complete: true,
          exact: true,
          providerSamplingApplied: false,
          maxSampleInterval: 1,
        },
        aliasRedirect: {
          sourceFingerprint: hash('2'),
          hostPartition: [
            {
              hostname: 'ogabassey.usebaci.com',
              requestCount: 0,
              eligibleRequestCount: 0,
              eligibleOriginAttemptCount: 0,
            },
            {
              hostname: 'www.ogabassey.com',
              requestCount: 0,
              eligibleRequestCount: 0,
              eligibleOriginAttemptCount: 0,
            },
          ],
          complete: true,
          exact: true,
          providerSamplingApplied: false,
          maxSampleInterval: 1,
        },
        wafRateLimit: {
          sourceFingerprint: hash('3'),
          rejectedMethodRequestCount: 0,
          rejectedMethodOriginCount: 0,
          allowedOriginRateLimitCount: 0,
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

export function seal<T extends ReturnType<typeof manifest>>(evidence: T) {
  for (const day of evidence.days)
    day.sha256 = calculateStorefrontDeliveryDailyEvidenceSha256(day);
  evidence.windowFingerprintSha256 =
    calculateStorefrontDeliveryWindowFingerprintSha256(evidence);
  return evidence;
}

export function withSyntheticProjection(
  evidence: ReturnType<typeof manifest>,
  requestCount: number,
  sourceRequestCount = requestCount,
  canonicalRequestCount = 1000
) {
  const day = evidence.days[0];
  day.canonicalEligibleRequestCount = canonicalRequestCount;
  day.syntheticQualificationRequestCount = requestCount;
  day.sourceEvidence.syntheticQualification.requestCount = sourceRequestCount;
  const canonicalTrafficRow = day.trafficPartition.find(
    (row) => row.hostname === 'ogabassey.com'
  );
  if (canonicalTrafficRow) {
    canonicalTrafficRow.requestCount = canonicalRequestCount;
    canonicalTrafficRow.eligibleRequestCount = canonicalRequestCount;
  }
  return evidence;
}

export function setTrafficPartitionCounts(
  day: ReturnType<typeof manifest>['days'][number],
  values: Partial<{
    canonicalRawRequestCount: number;
    aliasRawRequestCount: number;
    canonicalEligibleRequestCount: number;
    aliasEligibleRequestCount: number;
    canonicalEligibleOriginAttemptCount: number;
    aliasEligibleOriginRequestCount: number;
  }> = {}
) {
  const canonical = day.trafficPartition.filter(
    (row) => row.hostname === 'ogabassey.com'
  );
  const aliases = day.trafficPartition.filter(
    (row) => row.hostname !== 'ogabassey.com'
  );
  if (values.canonicalRawRequestCount !== undefined) {
    const requestCount = values.canonicalRawRequestCount;
    canonical[0].requestCount = requestCount;
    if (canonical[0].eligibleRequestCount > requestCount) {
      canonical[0].eligibleRequestCount = requestCount;
    }
    if (
      canonical[0].eligibleOriginAttemptCount >
      canonical[0].eligibleRequestCount
    ) {
      canonical[0].eligibleOriginAttemptCount =
        canonical[0].eligibleRequestCount;
    }
  }
  if (values.aliasRawRequestCount !== undefined) {
    const requestCount = values.aliasRawRequestCount;
    day.aliasRawRequestCount = requestCount;
    aliases[0].requestCount = requestCount;
    if (aliases[0].eligibleRequestCount > requestCount) {
      aliases[0].eligibleRequestCount = requestCount;
    }
    if (
      aliases[0].eligibleOriginAttemptCount > aliases[0].eligibleRequestCount
    ) {
      aliases[0].eligibleOriginAttemptCount = aliases[0].eligibleRequestCount;
    }
  }
  if (values.canonicalEligibleRequestCount !== undefined) {
    canonical[0].eligibleRequestCount = values.canonicalEligibleRequestCount;
  }
  if (values.aliasEligibleRequestCount !== undefined) {
    aliases[0].eligibleRequestCount = values.aliasEligibleRequestCount;
    aliases[1].eligibleRequestCount = 0;
  }
  if (values.canonicalEligibleOriginAttemptCount !== undefined) {
    canonical[0].eligibleOriginAttemptCount =
      values.canonicalEligibleOriginAttemptCount;
  }
  if (values.aliasEligibleOriginRequestCount !== undefined) {
    aliases[0].eligibleOriginAttemptCount =
      values.aliasEligibleOriginRequestCount;
    aliases[1].eligibleOriginAttemptCount = 0;
  }
  return day;
}

import { calculateStorefrontDeliveryDailyEvidenceSha256 } from './delivery-evidence';
import {
  calculateHostnameInventorySha256,
  calculateStorefrontDeliveryWindowFingerprintSha256,
} from './delivery-evidence-manifest';

const dailyEvidence = {
  utcDate: '2026-07-25',
  hostnameInventorySha256: 'a'.repeat(64),
  eligibilityPolicySha256: 'b'.repeat(64),
  aliasRulesetVersion: 'alias-v1',
  wafRulesetVersion: 'waf-v1',
  responseHeaderRulesetSha256: 'c'.repeat(64),
  rawOriginRobotsTxtSha256: 'd'.repeat(64),
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
      sourceFingerprint: '1'.repeat(64),
      complete: true,
      exact: true,
      providerSamplingApplied: false,
      maxSampleInterval: 1,
    },
    aliasRedirect: {
      sourceFingerprint: '2'.repeat(64),
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
      sourceFingerprint: '3'.repeat(64),
      complete: true,
      exact: true,
      providerSamplingApplied: false,
      maxSampleInterval: 1,
    },
    originEvent: {
      sourceFingerprint: '4'.repeat(64),
      requestCount: 0,
      complete: true,
      exact: true,
      providerSamplingApplied: false,
      maxSampleInterval: 1,
    },
    syntheticQualification: {
      sourceFingerprint: '5'.repeat(64),
      requestCount: 0,
      complete: true,
      exact: true,
      providerSamplingApplied: false,
      maxSampleInterval: 1,
    },
  },
  sha256: '',
};

export function sevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const day = {
      ...dailyEvidence,
      utcDate: `2026-07-${String(index + 25).padStart(2, '0')}`,
      exportedAt:
        index === 6
          ? '2026-08-01T00:00:00.000Z'
          : `2026-07-${String(index + 26).padStart(2, '0')}T00:00:00.000Z`,
      sha256: '',
    };
    day.sha256 = calculateStorefrontDeliveryDailyEvidenceSha256(day);
    return day;
  });
}

export function manifest() {
  const hostnameInventorySha256 = calculateHostnameInventorySha256([
    'ogabassey.com',
    'ogabassey.usebaci.com',
    'www.ogabassey.com',
  ]);
  const days = sevenDays().map((day) => {
    const next = { ...day, hostnameInventorySha256, sha256: '' };
    next.sha256 = calculateStorefrontDeliveryDailyEvidenceSha256(next);
    return next;
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
    eligibilityPolicySha256: 'b'.repeat(64),
    aliasRulesetVersion: 'alias-v1',
    wafRulesetVersion: 'waf-v1',
    responseHeaderRulesetSha256: 'c'.repeat(64),
    rawOriginRobotsTxtSha256: 'd'.repeat(64),
    workerDeploymentId: 'deployment-v1',
    originOnlyVersionId: 'origin-v1',
    edgeVersionId: 'edge-v1',
    sourceFingerprints: {
      invocation: '1'.repeat(64),
      aliasRedirect: '2'.repeat(64),
      wafRateLimit: '3'.repeat(64),
      originEvent: '4'.repeat(64),
      syntheticQualification: '5'.repeat(64),
    },
    evidenceSource: 'worker-analytics' as const,
    days,
  };
  return {
    ...base,
    windowFingerprintSha256:
      calculateStorefrontDeliveryWindowFingerprintSha256(base),
  };
}

import { describe, expect, it } from 'vitest';
import { calculateStorefrontDeliveryDailyEvidenceSha256 } from './delivery-evidence';
import {
  calculateHostnameInventorySha256,
  calculateStorefrontDeliveryWindowFingerprintSha256,
  validateStorefrontDeliveryManifest,
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

function sevenDays() {
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

const manifest = () => {
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
};

describe('validateStorefrontDeliveryManifest', () => {
  const now = new Date('2026-08-01T12:00:00.000Z');
  it('accepts exactly seven contiguous closed UTC days', () =>
    expect(validateStorefrontDeliveryManifest(manifest(), { now }).ok).toBe(
      true
    ));
  it('rejects a missing day and an unsorted or omitted hostname partition', () => {
    expect(
      validateStorefrontDeliveryManifest(
        { ...manifest(), days: sevenDays().slice(1) },
        { now }
      ).ok
    ).toBe(false);
    expect(
      validateStorefrontDeliveryManifest({
        ...manifest(),
        aliasHostnames: ['www.ogabassey.com'],
        inventoryHostnames: ['ogabassey.com', 'www.ogabassey.com'],
      }).ok
    ).toBe(false);
  });
  it('rejects tampered daily or canonical hostname-inventory hashes', () => {
    const tamperedDay = manifest();
    tamperedDay.days[0].sha256 = 'f'.repeat(64);
    expect(validateStorefrontDeliveryManifest(tamperedDay, { now }).ok).toBe(
      false
    );
    expect(
      validateStorefrontDeliveryManifest(
        { ...manifest(), hostnameInventorySha256: 'f'.repeat(64) },
        { now }
      ).ok
    ).toBe(false);
  });
  it('rejects a daily drift from each independent evidence source even with a resealed daily hash', () => {
    for (const source of [
      'invocation',
      'aliasRedirect',
      'wafRateLimit',
      'originEvent',
    ] as const) {
      const candidate = manifest();
      candidate.days[3].sourceEvidence[source].sourceFingerprint = 'f'.repeat(
        64
      );
      candidate.days[3].sha256 = calculateStorefrontDeliveryDailyEvidenceSha256(
        candidate.days[3]
      );
      expect(
        validateStorefrontDeliveryManifest(candidate, { now })
      ).toMatchObject({
        ok: false,
        reasonCodes: expect.arrayContaining(['source_fingerprint_drift']),
      });
    }
    const syntheticCandidate = manifest();
    syntheticCandidate.days[3].sourceEvidence.syntheticQualification = {
      ...syntheticCandidate.days[3].sourceEvidence.syntheticQualification,
      sourceFingerprint: 'f'.repeat(64),
    };
    syntheticCandidate.days[3].sha256 =
      calculateStorefrontDeliveryDailyEvidenceSha256(
        syntheticCandidate.days[3]
      );
    expect(
      validateStorefrontDeliveryManifest(syntheticCandidate, { now })
    ).toMatchObject({
      ok: false,
      reasonCodes: expect.arrayContaining(['source_fingerprint_drift']),
    });
  });
  it('rejects daily response-header and raw-origin robots identity drift even with a resealed daily hash', () => {
    for (const key of [
      'responseHeaderRulesetSha256',
      'rawOriginRobotsTxtSha256',
    ] as const) {
      const candidate = manifest();
      candidate.days[3][key] = 'f'.repeat(64);
      candidate.days[3].sha256 = calculateStorefrontDeliveryDailyEvidenceSha256(
        candidate.days[3]
      );
      expect(
        validateStorefrontDeliveryManifest(candidate, { now })
      ).toMatchObject({
        ok: false,
        reasonCodes: expect.arrayContaining(['fingerprint_drift']),
      });
    }
  });
  it('rejects calendar-invalid UTC boundaries even when their normalized duration hashes correctly', () => {
    const candidate = manifest();
    candidate.windowStart = '2026-02-30T00:00:00.000Z';
    expect(
      validateStorefrontDeliveryManifest(candidate, { now })
    ).toMatchObject({ ok: false, reasonCodes: ['manifest_invalid'] });
  });
  it('requires both known Ogabassey aliases at schema parse time', () => {
    expect(
      validateStorefrontDeliveryManifest(
        { ...manifest(), aliasHostnames: ['www.ogabassey.com'] },
        { now }
      )
    ).toMatchObject({ ok: false, reasonCodes: ['manifest_invalid'] });
  });
  it('rejects a stale window and an export timestamp after validation time', () => {
    const stale = manifest();
    stale.windowStart = '2026-06-25T00:00:00.000Z';
    stale.windowEnd = '2026-07-02T00:00:00.000Z';
    stale.days = sevenDays().map((day, index) => ({
      ...day,
      utcDate: new Date(Date.UTC(2026, 5, 25 + index))
        .toISOString()
        .slice(0, 10),
      exportedAt: new Date(Date.UTC(2026, 5, 26 + index)).toISOString(),
    }));
    expect(validateStorefrontDeliveryManifest(stale, { now })).toMatchObject({
      ok: false,
      reasonCodes: expect.arrayContaining(['window_stale']),
    });
    const future = manifest();
    future.days[6].exportedAt = '2026-08-01T13:00:00.000Z';
    future.days[6].sha256 = calculateStorefrontDeliveryDailyEvidenceSha256(
      future.days[6]
    );
    expect(validateStorefrontDeliveryManifest(future, { now })).toMatchObject({
      ok: false,
      reasonCodes: expect.arrayContaining(['day_exported_in_future']),
    });
  });
});

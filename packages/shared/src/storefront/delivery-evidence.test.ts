import { describe, expect, it } from 'vitest';
import {
  calculateCanonicalSha256,
  canonicalizeJson,
  StorefrontDeliveryDailyEvidenceSchema,
} from './delivery-evidence';
import { dailyEvidence } from './delivery-evidence.test-fixtures';

describe('StorefrontDeliveryDailyEvidenceSchema', () => {
  it('uses the canonical SHA-256 digest rather than a runtime-specific hash provider', () => {
    expect(calculateCanonicalSha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(calculateCanonicalSha256('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
    expect(calculateCanonicalSha256('a'.repeat(56))).toBe(
      'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a'
    );
    expect(calculateCanonicalSha256('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'
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
    const sparse = [1, 2, 3];
    delete sparse[1];
    expect(() => canonicalizeJson(sparse)).toThrow('sparse');
    expect(() => canonicalizeJson({ [Symbol('hidden')]: 'value' })).toThrow(
      'symbol'
    );
    expect(canonicalizeJson([1, null, 3])).not.toBe(canonicalizeJson([1, 3]));
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

  it('requires the sealed response-header and raw-origin robots identities', () => {
    for (const key of [
      'responseHeaderRulesetSha256',
      'rawOriginRobotsTxtSha256',
    ] as const) {
      const candidate: Record<string, unknown> = { ...dailyEvidence };
      delete candidate[key];
      expect(
        StorefrontDeliveryDailyEvidenceSchema.safeParse(candidate).success
      ).toBe(false);
    }
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
  it('parses source exactness metadata for the completeness gate', () => {
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
  it('requires an independently counted synthetic qualification projection', () => {
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse({
        ...dailyEvidence,
        sourceEvidence: {
          ...dailyEvidence.sourceEvidence,
          syntheticQualification: {
            ...dailyEvidence.sourceEvidence.syntheticQualification,
            requestCount: 1,
          },
        },
      }).success
    ).toBe(true);
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse({
        ...dailyEvidence,
        sourceEvidence: {
          ...dailyEvidence.sourceEvidence,
          syntheticQualification: {
            ...dailyEvidence.sourceEvidence.syntheticQualification,
            requestCount: undefined,
          },
        },
      }).success
    ).toBe(false);
  });
  it('requires an independently counted origin-event projection', () => {
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse({
        ...dailyEvidence,
        sourceEvidence: {
          ...dailyEvidence.sourceEvidence,
          originEvent: {
            ...dailyEvidence.sourceEvidence.originEvent,
            requestCount: undefined,
          },
        },
      }).success
    ).toBe(false);
  });
  it('requires independently counted invocation and WAF/rate-limit projections', () => {
    const missingInvocationCount = {
      ...dailyEvidence,
      sourceEvidence: {
        ...dailyEvidence.sourceEvidence,
        invocation: {
          ...dailyEvidence.sourceEvidence.invocation,
          requestCount: undefined,
        },
      },
    };
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse(missingInvocationCount)
        .success
    ).toBe(false);
    const missingWafCount = {
      ...dailyEvidence,
      sourceEvidence: {
        ...dailyEvidence.sourceEvidence,
        wafRateLimit: {
          ...dailyEvidence.sourceEvidence.wafRateLimit,
          allowedOriginRateLimitCount: undefined,
        },
      },
    };
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse(missingWafCount).success
    ).toBe(false);
  });
  it('requires an independent all-alias raw request total', () => {
    const candidate: Record<string, unknown> = { ...dailyEvidence };
    delete candidate.aliasRawRequestCount;
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse(candidate).success
    ).toBe(false);
  });
  it('requires bounded per-host alias evidence', () => {
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse({
        ...dailyEvidence,
        sourceEvidence: {
          ...dailyEvidence.sourceEvidence,
          aliasRedirect: {
            ...dailyEvidence.sourceEvidence.aliasRedirect,
            hostPartition: [],
          },
        },
      }).success
    ).toBe(false);
  });

  it('accepts bounded host, method, path, and rule aggregates but rejects raw path values', () => {
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse(dailyEvidence).success
    ).toBe(true);
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse({
        ...dailyEvidence,
        trafficPartition: [
          {
            ...dailyEvidence.trafficPartition[0],
            pathClass: '/products/secret?customer=1',
          },
          ...dailyEvidence.trafficPartition.slice(1),
        ],
      }).success
    ).toBe(false);
  });

  it('rejects a partition whose eligible count exceeds its raw count', () => {
    expect(
      StorefrontDeliveryDailyEvidenceSchema.safeParse({
        ...dailyEvidence,
        trafficPartition: [
          {
            ...dailyEvidence.trafficPartition[0],
            requestCount: 0,
            eligibleRequestCount: 1,
          },
          ...dailyEvidence.trafficPartition.slice(1),
        ],
      }).success
    ).toBe(false);
  });
});

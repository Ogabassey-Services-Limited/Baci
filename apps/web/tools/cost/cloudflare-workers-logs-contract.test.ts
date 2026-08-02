import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  MAX_REVIEWED_USAGE_OBSERVATION_LAG_SECONDS,
  retrieveCurrentCloudflareWorkersLogsContract,
  validateCloudflareWorkersLogsPlanContract,
} from './cloudflare-workers-logs-contract';

const now = new Date('2026-08-01T12:00:00.000Z');
const docs = 'current-workers-logs-docs';
const entitlementProjection = {
  plan: 'free' as const,
  allowanceEvents: '200000',
  allowancePeriod: 'utc_day' as const,
  allowancePeriodStartsAt: '2026-08-01T00:00:00.000Z',
  allowancePeriodEndsAt: '2026-08-02T00:00:00.000Z',
  currentAllowancePeriodAllAccountEvents: '1234',
  allowanceUsageSourceFingerprint: '1'.repeat(64),
  allowanceMaximumObservationLagSeconds: 3600,
  allowanceObservedAt: '2026-08-01T11:30:00.000Z',
  utcDayStartsAt: '2026-08-01T00:00:00.000Z',
  utcDayEndsAt: '2026-08-02T00:00:00.000Z',
  currentUtcDayAllAccountEvents: '2345',
  otherWorkersWorstCaseDailyLogEvents: '0',
  utcDayUsageSourceFingerprint: '2'.repeat(64),
  utcDayMaximumObservationLagSeconds: 3600,
  utcDayObservedAt: '2026-08-01T11:30:00.000Z',
  overageAllowed: false,
  overageUsdPerMillion: null,
  forcedSamplingDailyThreshold: '5000000000',
  forcedSamplingRate: '0.01',
};

function contractFor(entitlement = entitlementProjection) {
  const rawEntitlement = JSON.stringify(entitlement);
  return {
    ...entitlement,
    allowanceEvents: BigInt(entitlement.allowanceEvents),
    currentAllowancePeriodAllAccountEvents: BigInt(
      entitlement.currentAllowancePeriodAllAccountEvents
    ),
    currentUtcDayAllAccountEvents: BigInt(
      entitlement.currentUtcDayAllAccountEvents
    ),
    otherWorkersWorstCaseDailyLogEvents: BigInt(
      entitlement.otherWorkersWorstCaseDailyLogEvents
    ),
    forcedSamplingDailyThreshold: BigInt(
      entitlement.forcedSamplingDailyThreshold
    ),
    officialDocsSha256: createHash('sha256').update(docs).digest('hex'),
    authenticatedEntitlementSha256: createHash('sha256')
      .update(rawEntitlement)
      .digest('hex'),
  };
}
function paidContract() {
  return {
    ...contractFor(),
    plan: 'paid' as const,
    allowanceEvents: 20_000_000n,
    allowancePeriod: 'billing_month' as const,
    allowancePeriodStartsAt: '2026-08-01T00:00:00.000Z',
    allowancePeriodEndsAt: '2026-09-01T00:00:00.000Z',
    overageAllowed: true,
    overageUsdPerMillion: '0.60',
  };
}

describe('Cloudflare Workers Logs plan contract', () => {
  it('requires a full current UTC day for the forced-sampling counter', () =>
    expect(
      validateCloudflareWorkersLogsPlanContract(contractFor(), { now })
    ).toMatchObject({ currentUtcDayAllAccountEvents: 2345n }));
  it('accepts a serialized contract by normalizing safe integer and decimal-string counters', () => {
    const serialized = JSON.parse(
      JSON.stringify(contractFor(), (_, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    ) as unknown;
    expect(
      validateCloudflareWorkersLogsPlanContract(serialized, { now })
    ).toMatchObject({ allowanceEvents: 200000n });
  });
  it('rejects an arbitrary partial UTC-day interval', () => {
    expect(() =>
      validateCloudflareWorkersLogsPlanContract(
        {
          ...contractFor(),
          utcDayStartsAt: '2026-08-01T11:00:00.000Z',
          utcDayEndsAt: '2026-08-01T13:00:00.000Z',
        },
        { now }
      )
    ).toThrow('full current day');
  });
  it('accepts the paid monthly allowance contract with the current UTC-day counter', () =>
    expect(
      validateCloudflareWorkersLogsPlanContract(paidContract(), { now })
    ).toMatchObject({
      plan: 'paid',
      allowanceEvents: 20_000_000n,
      allowancePeriod: 'billing_month',
    }));
  it('accepts the maximum bounded other-worker daily event measurement', () =>
    expect(
      validateCloudflareWorkersLogsPlanContract(
        contractFor({
          ...entitlementProjection,
          otherWorkersWorstCaseDailyLogEvents: '5000000000',
        }),
        { now }
      ).otherWorkersWorstCaseDailyLogEvents
    ).toBe(5_000_000_000n));
  it('rejects an unbounded other-worker daily event measurement', () =>
    expect(() =>
      validateCloudflareWorkersLogsPlanContract(
        contractFor({
          ...entitlementProjection,
          otherWorkersWorstCaseDailyLogEvents: '5000000001',
        }),
        { now }
      )
    ).toThrow());
  it('rejects an allowance observation older than its declared maximum lag', () => {
    expect(() =>
      validateCloudflareWorkersLogsPlanContract(
        {
          ...contractFor(),
          allowanceObservedAt: '2026-08-01T09:00:00.000Z',
        },
        { now }
      )
    ).toThrow('stale');
  });
  it('rejects a paid allowance lag that exceeds the reviewed operational maximum', () => {
    const monthEnd = new Date('2026-08-31T23:00:00.000Z');
    const monthLongLagSeconds = 31 * 24 * 60 * 60;
    expect(() =>
      validateCloudflareWorkersLogsPlanContract(
        {
          ...paidContract(),
          allowanceObservedAt: '2026-08-01T00:00:00.000Z',
          allowanceMaximumObservationLagSeconds: monthLongLagSeconds,
          utcDayStartsAt: '2026-08-31T00:00:00.000Z',
          utcDayEndsAt: '2026-09-01T00:00:00.000Z',
          utcDayObservedAt: '2026-08-31T22:30:00.000Z',
        },
        { now: monthEnd }
      )
    ).toThrow('reviewed operational maximum');
  });
  it('accepts the reviewed operational maximum for both usage counters', () => {
    expect(() =>
      validateCloudflareWorkersLogsPlanContract(
        {
          ...contractFor(),
          allowanceMaximumObservationLagSeconds:
            MAX_REVIEWED_USAGE_OBSERVATION_LAG_SECONDS,
          utcDayMaximumObservationLagSeconds:
            MAX_REVIEWED_USAGE_OBSERVATION_LAG_SECONDS,
        },
        { now }
      )
    ).not.toThrow();
  });
  it('derives every usage field from the authenticated entitlement projection', async () => {
    const rawEntitlement = JSON.stringify(entitlementProjection);
    await expect(
      retrieveCurrentCloudflareWorkersLogsContract(
        async () => docs,
        async () => rawEntitlement,
        { ...contractFor(), currentUtcDayAllAccountEvents: 0n },
        { now }
      )
    ).rejects.toThrow('entitlement projection drifted');
    await expect(
      retrieveCurrentCloudflareWorkersLogsContract(
        async () => docs,
        async () => rawEntitlement,
        contractFor(),
        { now }
      )
    ).resolves.toMatchObject({ currentUtcDayAllAccountEvents: 2345n });
  });
  it('rejects official documentation digest drift', async () => {
    await expect(
      retrieveCurrentCloudflareWorkersLogsContract(
        async () => 'changed-workers-logs-docs',
        async () => JSON.stringify(entitlementProjection),
        contractFor(),
        { now }
      )
    ).rejects.toThrow('documentation or entitlement receipt drifted');
  });
  it('accepts the provider envelope only when its normalized result is complete', async () => {
    const rawEntitlement = JSON.stringify({ result: entitlementProjection });
    const wrappedContract = {
      ...contractFor(),
      authenticatedEntitlementSha256: createHash('sha256')
        .update(rawEntitlement)
        .digest('hex'),
    };
    await expect(
      retrieveCurrentCloudflareWorkersLogsContract(
        async () => docs,
        async () => rawEntitlement,
        wrappedContract,
        { now }
      )
    ).resolves.toBeDefined();
  });
  it('ignores only the contract receipt digests when a serialized full contract is returned', async () => {
    const fullReceipt = JSON.stringify(contractFor(), (_, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value
    );
    await expect(
      retrieveCurrentCloudflareWorkersLogsContract(
        async () => docs,
        async () => fullReceipt,
        {
          ...contractFor(),
          authenticatedEntitlementSha256: createHash('sha256')
            .update(fullReceipt)
            .digest('hex'),
        },
        { now }
      )
    ).resolves.toBeDefined();
  });
});
